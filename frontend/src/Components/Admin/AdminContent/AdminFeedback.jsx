"use client";

import { useCallback, useEffect, useState } from "react";
import api from "../../../utils/api";
import {
  Field,
  Modal,
  Notice,
  Pill,
  errMsg,
  formatDate,
  useNotice,
} from "./EngagementShared";

const STATUS_TONE = { OPEN: "warning", REVIEWED: "info", RESOLVED: "success" };

function RespondModal({ item, onClose, onSaved, onError }) {
  const [status, setStatus] = useState(
    item.status === "OPEN" ? "RESOLVED" : item.status,
  );
  const [response, setResponse] = useState(item.adminResponse || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.put(`/engagement/feedback/admin/${item._id}`, {
        status,
        adminResponse: response.trim(),
      });
      onSaved();
    } catch (error) {
      onError(errMsg(error, "Could not save the response."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Respond to feedback"
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
            {saving ? "Saving..." : "Save response"}
          </button>
        </>
      }
    >
      <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{item.subject}</p>
      <p
        className="eng-muted"
        style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}
      >
        {item.message}
      </p>
      <div className="eng-form-grid">
        <Field label="Status" full>
          <select
            className="eng-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="OPEN">Open</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </Field>
        <Field
          label="Reply to commuter"
          hint="The commuter sees this in the app and gets a notification."
          full
        >
          <textarea
            className="eng-textarea"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            maxLength={2000}
          />
        </Field>
      </div>
    </Modal>
  );
}

function AdminFeedback() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ OPEN: 0, REVIEWED: 0, RESOLVED: 0 });
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const [notice, showNotice] = useNotice();

  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      try {
        const res = await api.get("/engagement/feedback/admin", {
          params: { page: nextPage, limit: 15, status: status || undefined },
        });
        const data = res.data?.data || {};
        setItems((prev) =>
          nextPage > 1 ? [...prev, ...(data.items || [])] : data.items || [],
        );
        setStats(data.stats || { OPEN: 0, REVIEWED: 0, RESOLVED: 0 });
        setHasMore(!!data.hasMore);
        setPage(nextPage);
      } catch (error) {
        showNotice("error", errMsg(error, "Could not load feedback."));
      } finally {
        setLoading(false);
      }
    },
    [status, showNotice],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div className="eng-wrap">
      <Notice notice={notice} />
      <div className="eng-stats">
        <div className="eng-stat">
          <b>{stats.OPEN}</b>
          <span>Open</span>
        </div>
        <div className="eng-stat">
          <b>{stats.REVIEWED}</b>
          <span>Reviewed</span>
        </div>
        <div className="eng-stat">
          <b>{stats.RESOLVED}</b>
          <span>Resolved</span>
        </div>
      </div>

      <div className="eng-toolbar">
        <select
          className="eng-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All feedback</option>
          <option value="OPEN">Open</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {loading && !items.length ? (
        <div className="eng-empty">Loading feedback...</div>
      ) : !items.length ? (
        <div className="eng-empty">No feedback submitted yet.</div>
      ) : (
        items.map((f) => (
          <div className="eng-feedback-card" key={f._id}>
            <div className="eng-feedback-head">
              <div>
                <b>{f.subject}</b>
                <div className="eng-muted" style={{ marginTop: 2 }}>
                  {f.user?.fullName || "Deleted user"} (
                  {f.role || f.user?.role || "user"}) | {f.category} |{" "}
                  {f.rating}/5 | {formatDate(f.createdAt)}
                </div>
              </div>
              <div className="eng-actions">
                <Pill tone={STATUS_TONE[f.status]}>
                  {f.status[0] + f.status.slice(1).toLowerCase()}
                </Pill>
                <button
                  type="button"
                  className="eng-btn ghost small"
                  onClick={() => setResponding(f)}
                >
                  {f.adminResponse ? "Edit reply" : "Respond"}
                </button>
              </div>
            </div>
            <p>{f.message}</p>
            {f.adminResponse ? (
              <div className="eng-reply">{f.adminResponse}</div>
            ) : null}
          </div>
        ))
      )}

      {hasMore ? (
        <div className="eng-pager">
          <button
            type="button"
            className="eng-btn ghost"
            onClick={() => load(page + 1)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}

      {responding ? (
        <RespondModal
          item={responding}
          onClose={() => setResponding(null)}
          onError={(m) => showNotice("error", m)}
          onSaved={() => {
            setResponding(null);
            showNotice("success", "Response saved.");
            load(1);
          }}
        />
      ) : null}
    </div>
  );
}

export default AdminFeedback;
