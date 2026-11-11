"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../../utils/api";
import "./AdminEngagement.css";

export const errMsg = (
  error,
  fallback = "Something went wrong. Please try again.",
) => error?.response?.data?.message || fallback;

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

// <input type="datetime-local"> needs local time without a timezone suffix.
export const toLocalInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function useNotice() {
  const [notice, setNotice] = useState(null);
  const timer = useRef(null);
  const show = useCallback((type, text) => {
    clearTimeout(timer.current);
    setNotice({ type, text });
    timer.current = setTimeout(() => setNotice(null), 4500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [notice, show];
}

export function Notice({ notice }) {
  if (!notice) return null;
  return (
    <div className={`eng-notice ${notice.type}`} role="status">
      {notice.text}
    </div>
  );
}

export function Pill({ tone = "muted", children }) {
  return <span className={`eng-pill ${tone}`}>{children}</span>;
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="eng-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`eng-modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="eng-modal-head">
          <h3>{title}</h3>
          <button
            type="button"
            className="eng-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="eng-modal-body">{children}</div>
        {footer ? <div className="eng-modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  busy,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="eng-btn ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="eng-btn danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </>
      }
    >
      <p className="eng-muted">{message}</p>
    </Modal>
  );
}

export function ImageUploader({ value, onChange, onError }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return onError?.("Please choose an image file.");
    if (file.size > 10 * 1024 * 1024)
      return onError?.("Image must be smaller than 10MB.");
    const body = new FormData();
    body.append("image", file);
    setUploading(true);
    try {
      const res = await api.post("/engagement/admin/upload-cover", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(res.data?.data?.url || "");
    } catch (error) {
      onError?.(errMsg(error, "Could not upload the image."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="eng-uploader">
      {value ? (
        <img src={value} alt="Cover preview" className="eng-cover-preview" />
      ) : (
        <div className="eng-cover-empty">No cover image</div>
      )}
      <div className="eng-uploader-actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={pick}
        />
        <button
          type="button"
          className="eng-btn ghost"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading
            ? "Uploading..."
            : value
              ? "Replace image"
              : "Upload image"}
        </button>
        {value ? (
          <button
            type="button"
            className="eng-btn link"
            onClick={() => onChange("")}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Use as="div" for fields that contain buttons so a label click never triggers them.
export function Field({ label, hint, children, full, as: Tag = "label" }) {
  return (
    <Tag className={`eng-field ${full ? "full" : ""}`}>
      <span className="eng-label">{label}</span>
      {children}
      {hint ? <span className="eng-hint">{hint}</span> : null}
    </Tag>
  );
}
