"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../../utils/api";
import {
  ConfirmModal,
  Field,
  ImageUploader,
  Modal,
  Notice,
  Pill,
  errMsg,
  formatDate,
  toLocalInput,
  useNotice,
} from "./EngagementShared";

const PHASE_TONE = { LIVE: "success", UPCOMING: "warning", ENDED: "muted" };

const defaultForm = () => {
  const start = new Date();
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    prize: "",
    rules: "",
    coverImage: "",
    startsAt: toLocalInput(start),
    endsAt: toLocalInput(end),
    maxWinners: 1,
    isActive: true,
    notifyUsers: true,
  };
};

function ContestForm({ contest, onSaved, onClose, onError }) {
  const editing = !!contest?._id;
  const [form, setForm] = useState(() =>
    editing
      ? {
          title: contest.title,
          description: contest.description || "",
          prize: contest.prize || "",
          rules: (contest.rules || []).join("\n"),
          coverImage: contest.coverImage || "",
          startsAt: toLocalInput(contest.startsAt),
          endsAt: toLocalInput(contest.endsAt),
          maxWinners: contest.maxWinners || 1,
          isActive: contest.isActive,
          notifyUsers: false,
        }
      : defaultForm(),
  );
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const submit = async () => {
    if (!form.title.trim()) return onError("Title is required.");
    if (!form.startsAt || !form.endsAt)
      return onError("Start and end dates are required.");
    if (new Date(form.endsAt) <= new Date(form.startsAt))
      return onError("End date must be after the start date.");
    const payload = {
      ...form,
      title: form.title.trim(),
      rules: form.rules
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean),
      maxWinners: Math.max(1, Number(form.maxWinners) || 1),
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
    };
    setSaving(true);
    try {
      if (editing)
        await api.put(`/engagement/contests/${contest._id}`, payload);
      else await api.post("/engagement/contests", payload);
      onSaved(editing);
    } catch (error) {
      onError(errMsg(error, "Could not save the contest."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title={editing ? "Edit contest" : "New contest"}
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
            {saving ? "Saving..." : editing ? "Save changes" : "Create contest"}
          </button>
        </>
      }
    >
      <div className="eng-form-grid">
        <Field label="Title" full>
          <input
            className="eng-input"
            value={form.title}
            onChange={set("title")}
            maxLength={160}
          />
        </Field>
        <Field label="Description" full>
          <textarea
            className="eng-textarea"
            value={form.description}
            onChange={set("description")}
            maxLength={2000}
          />
        </Field>
        <Field label="Prize">
          <input
            className="eng-input"
            value={form.prize}
            onChange={set("prize")}
            maxLength={200}
            placeholder="e.g. Free month pass"
          />
        </Field>
        <Field label="Number of winners">
          <input
            className="eng-input"
            type="number"
            min={1}
            value={form.maxWinners}
            onChange={set("maxWinners")}
          />
        </Field>
        <Field label="Starts">
          <input
            className="eng-input"
            type="datetime-local"
            value={form.startsAt}
            onChange={set("startsAt")}
          />
        </Field>
        <Field label="Ends">
          <input
            className="eng-input"
            type="datetime-local"
            value={form.endsAt}
            onChange={set("endsAt")}
          />
        </Field>
        <Field label="Rules" hint="One rule per line." full>
          <textarea
            className="eng-textarea"
            value={form.rules}
            onChange={set("rules")}
          />
        </Field>
        <Field label="Cover image" full as="div">
          <ImageUploader
            value={form.coverImage}
            onChange={(url) => setForm((f) => ({ ...f, coverImage: url }))}
            onError={onError}
          />
        </Field>
        <label className="eng-check">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={set("isActive")}
          />
          Active (visible in the mobile app)
        </label>
        {!editing || !contest.notifiedAt ? (
          <label className="eng-check">
            <input
              type="checkbox"
              checked={form.notifyUsers}
              onChange={set("notifyUsers")}
            />
            Notify all commuters
          </label>
        ) : (
          <span className="eng-muted">
            Commuters were notified on {formatDate(contest.notifiedAt)}.
          </span>
        )}
      </div>
    </Modal>
  );
}

function EntriesModal({ contest, onClose, onError }) {
  const [entries, setEntries] = useState(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let live = true;
    api
      .get(`/engagement/contests/${contest._id}/entries`)
      .then((res) => live && setEntries(res.data?.data?.entries || []))
      .catch((error) => {
        if (live) {
          setEntries([]);
          onErrorRef.current(errMsg(error, "Could not load entries."));
        }
      });
    return () => {
      live = false;
    };
  }, [contest._id]);

  return (
    <Modal title={`Entries: ${contest.title}`} onClose={onClose} wide>
      {entries === null ? (
        <p className="eng-muted">Loading entries...</p>
      ) : !entries.length ? (
        <p className="eng-muted">Nobody has joined this contest yet.</p>
      ) : (
        <table className="eng-table">
          <thead>
            <tr>
              <th>Commuter</th>
              <th>Email</th>
              <th>Joined</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e._id}>
                <td>{e.user?.fullName || "Deleted user"}</td>
                <td>{e.user?.email || "-"}</td>
                <td>{formatDate(e.createdAt)}</td>
                <td>
                  {e.status === "WINNER" ? (
                    <Pill tone="success">Winner</Pill>
                  ) : (
                    <Pill tone="muted">Entered</Pill>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function AdminContests() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, showNotice] = useNotice();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/engagement/contests/admin/all");
      setItems(res.data?.data?.items || []);
    } catch (error) {
      showNotice("error", errMsg(error, "Could not load contests."));
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    load();
  }, [load]);

  const pickWinners = async (contest) => {
    setBusy(true);
    try {
      const res = await api.post(`/engagement/contests/${contest._id}/winners`);
      const count = res.data?.data?.winners?.length || 0;
      showNotice(
        "success",
        `${count} winner${count === 1 ? "" : "s"} picked and notified.`,
      );
      load();
    } catch (error) {
      showNotice("error", errMsg(error, "Could not pick winners."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/engagement/contests/${removing._id}`);
      setRemoving(null);
      showNotice("success", "Contest deleted.");
      load();
    } catch (error) {
      showNotice("error", errMsg(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="eng-wrap">
      <Notice notice={notice} />
      <div className="eng-toolbar">
        <span className="grow eng-muted">
          Contests appear in the mobile app Contests screen. Winners are picked
          at random from entries once a contest ends.
        </span>
        <button
          type="button"
          className="eng-btn primary"
          onClick={() => setEditing({})}
        >
          New contest
        </button>
      </div>

      {loading && !items.length ? (
        <div className="eng-empty">Loading contests...</div>
      ) : !items.length ? (
        <div className="eng-empty">No contests yet.</div>
      ) : (
        <div className="eng-card-grid">
          {items.map((c) => (
            <article className="eng-card" key={c._id}>
              {c.coverImage ? <img src={c.coverImage} alt="" /> : null}
              <div className="pad">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill tone={PHASE_TONE[c.phase]}>
                    {c.phase === "LIVE"
                      ? "Live"
                      : c.phase === "UPCOMING"
                        ? "Upcoming"
                        : "Ended"}
                  </Pill>
                  {!c.isActive ? <Pill tone="danger">Hidden</Pill> : null}
                </div>
                <h4>{c.title}</h4>
                {c.prize ? <div className="meta">Prize: {c.prize}</div> : null}
                <div className="meta">
                  {formatDate(c.startsAt)} - {formatDate(c.endsAt)}
                </div>
                <div className="meta">
                  {c.entries} {c.entries === 1 ? "entry" : "entries"} |{" "}
                  {c.winners}/{c.maxWinners} winner
                  {c.maxWinners === 1 ? "" : "s"}
                </div>
                <div
                  className="eng-actions"
                  style={{
                    justifyContent: "flex-start",
                    marginTop: "auto",
                    paddingTop: 8,
                  }}
                >
                  <button
                    type="button"
                    className="eng-btn ghost small"
                    onClick={() => setViewing(c)}
                  >
                    Entries
                  </button>
                  {c.phase === "ENDED" && !c.winners ? (
                    <button
                      type="button"
                      className="eng-btn primary small"
                      onClick={() => pickWinners(c)}
                      disabled={busy || !c.entries}
                    >
                      Pick winners
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="eng-btn ghost small"
                    onClick={() => setEditing(c)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="eng-btn danger-ghost small"
                    onClick={() => setRemoving(c)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing ? (
        <ContestForm
          contest={editing}
          onClose={() => setEditing(null)}
          onError={(m) => showNotice("error", m)}
          onSaved={(wasEditing) => {
            setEditing(null);
            showNotice(
              "success",
              wasEditing ? "Contest updated." : "Contest created.",
            );
            load();
          }}
        />
      ) : null}
      {viewing ? (
        <EntriesModal
          contest={viewing}
          onClose={() => setViewing(null)}
          onError={(m) => showNotice("error", m)}
        />
      ) : null}
      {removing ? (
        <ConfirmModal
          title="Delete contest"
          message={`"${removing.title}" and all of its entries will be permanently removed.`}
          busy={busy}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

export default AdminContests;
