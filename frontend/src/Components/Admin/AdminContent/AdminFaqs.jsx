"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../utils/api";
import {
  ConfirmModal,
  Field,
  Modal,
  Notice,
  Pill,
  errMsg,
  useNotice,
} from "./EngagementShared";

const DEFAULT_CATEGORIES = [
  "General",
  "Booking",
  "Payments",
  "Account",
  "Safety",
];

function FaqForm({ faq, categories, onSaved, onClose, onError }) {
  const editing = !!faq?._id;
  const [form, setForm] = useState({
    question: faq?.question || "",
    answer: faq?.answer || "",
    category: faq?.category || categories[0] || "General",
    order: faq?.order ?? 0,
    isActive: faq?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const submit = async () => {
    if (!form.question.trim() || !form.answer.trim())
      return onError("Question and answer are required.");
    const payload = {
      ...form,
      question: form.question.trim(),
      answer: form.answer.trim(),
      category: form.category.trim() || "General",
      order: Number(form.order) || 0,
    };
    setSaving(true);
    try {
      if (editing) await api.put(`/engagement/faqs/${faq._id}`, payload);
      else await api.post("/engagement/faqs", payload);
      onSaved(editing);
    } catch (error) {
      onError(errMsg(error, "Could not save the FAQ."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? "Edit FAQ" : "New FAQ"}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="eng-btn ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="eng-btn primary"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="eng-form-grid">
        <Field label="Question" full>
          <input
            className="eng-input"
            value={form.question}
            onChange={set("question")}
            maxLength={240}
          />
        </Field>
        <Field label="Answer" full>
          <textarea
            className="eng-textarea"
            value={form.answer}
            onChange={set("answer")}
            maxLength={4000}
          />
        </Field>
        <Field label="Category" hint="Pick an existing one or type a new name.">
          <input
            className="eng-input"
            list="faq-categories"
            value={form.category}
            onChange={set("category")}
            maxLength={40}
          />
          <datalist id="faq-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Order" hint="Lower numbers appear first.">
          <input
            className="eng-input"
            type="number"
            value={form.order}
            onChange={set("order")}
          />
        </Field>
        <label className="eng-check">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={set("isActive")}
          />
          Visible in the mobile app
        </label>
      </div>
    </Modal>
  );
}

function AdminFaqs() {
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, showNotice] = useNotice();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/engagement/faqs/admin/all");
      setFaqs(res.data?.data?.faqs || []);
      setCategories(res.data?.data?.categories || []);
    } catch (error) {
      showNotice("error", errMsg(error, "Could not load FAQs."));
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryOptions = useMemo(
    () => Array.from(new Set([...categories, ...DEFAULT_CATEGORIES])).sort(),
    [categories],
  );

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = faqs.filter(
      (f) =>
        (category === "All" || f.category === category) &&
        (!q ||
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q)),
    );
    return visible.reduce((acc, f) => {
      (acc[f.category] ||= []).push(f);
      return acc;
    }, {});
  }, [faqs, category, query]);

  const toggleActive = async (faq) => {
    try {
      await api.put(`/engagement/faqs/${faq._id}`, { isActive: !faq.isActive });
      setFaqs((prev) =>
        prev.map((f) =>
          f._id === faq._id ? { ...f, isActive: !f.isActive } : f,
        ),
      );
    } catch (error) {
      showNotice("error", errMsg(error));
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/engagement/faqs/${removing._id}`);
      setRemoving(null);
      showNotice("success", "FAQ deleted.");
      load();
    } catch (error) {
      showNotice("error", errMsg(error));
    } finally {
      setBusy(false);
    }
  };

  const groups = Object.entries(grouped);

  return (
    <div className="eng-wrap">
      <Notice notice={notice} />
      <div className="eng-toolbar">
        <input
          className="eng-input"
          placeholder="Search questions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search FAQs"
        />
        <select
          className="eng-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="All">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="grow" />
        <button
          type="button"
          className="eng-btn primary"
          onClick={() => setEditing({})}
        >
          New FAQ
        </button>
      </div>

      {loading && !faqs.length ? (
        <div className="eng-empty">Loading FAQs...</div>
      ) : !groups.length ? (
        <div className="eng-empty">
          No FAQs found. Add one and it will show in the mobile app FAQs screen.
        </div>
      ) : (
        groups.map(([name, list]) => (
          <section className="eng-group" key={name}>
            <h4>
              {name} ({list.length})
            </h4>
            {list.map((faq) => (
              <div className="eng-faq-row" key={faq._id}>
                <div className="body">
                  <b>{faq.question}</b>
                  <p>{faq.answer}</p>
                </div>
                <div className="eng-actions" style={{ flexShrink: 0 }}>
                  <Pill tone={faq.isActive ? "success" : "muted"}>
                    {faq.isActive ? "Visible" : "Hidden"}
                  </Pill>
                  <button
                    type="button"
                    className="eng-btn ghost small"
                    onClick={() => toggleActive(faq)}
                  >
                    {faq.isActive ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    className="eng-btn ghost small"
                    onClick={() => setEditing(faq)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="eng-btn danger-ghost small"
                    onClick={() => setRemoving(faq)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      {editing ? (
        <FaqForm
          faq={editing}
          categories={categoryOptions}
          onClose={() => setEditing(null)}
          onError={(m) => showNotice("error", m)}
          onSaved={(wasEditing) => {
            setEditing(null);
            showNotice("success", wasEditing ? "FAQ updated." : "FAQ added.");
            load();
          }}
        />
      ) : null}
      {removing ? (
        <ConfirmModal
          title="Delete FAQ"
          message={`"${removing.question}" will be permanently removed.`}
          busy={busy}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

export default AdminFaqs;
