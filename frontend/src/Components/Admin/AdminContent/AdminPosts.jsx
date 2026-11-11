"use client";

import { useCallback, useEffect, useState } from "react";
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

const EMPTY = {
  type: "NEWS",
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  author: "DriveMeGo Team",
  tags: "",
  isPublished: true,
  publishedAt: toLocalInput(new Date()),
  notifyUsers: true,
};

function PostForm({ post, onSaved, onClose, onError }) {
  const editing = !!post?._id;
  const [form, setForm] = useState(() =>
    editing
      ? {
          type: post.type,
          title: post.title,
          excerpt: post.excerpt || "",
          content: post.content || "",
          coverImage: post.coverImage || "",
          author: post.author || "",
          tags: (post.tags || []).join(", "),
          isPublished: post.isPublished,
          publishedAt: toLocalInput(post.publishedAt),
          notifyUsers: false,
        }
      : EMPTY,
  );
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const submit = async () => {
    if (!form.title.trim()) return onError("Title is required.");
    if (!form.content.trim()) return onError("Content is required.");
    const payload = {
      ...form,
      title: form.title.trim(),
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      publishedAt: form.publishedAt
        ? new Date(form.publishedAt).toISOString()
        : new Date().toISOString(),
    };
    setSaving(true);
    try {
      const res = editing
        ? await api.put(`/engagement/posts/${post._id}`, payload)
        : await api.post("/engagement/posts", payload);
      onSaved(res.data?.data?.post, editing);
    } catch (error) {
      onError(errMsg(error, "Could not save the article."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title={editing ? "Edit article" : "New article"}
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
            {saving
              ? "Saving..."
              : editing
                ? "Save changes"
                : form.isPublished
                  ? "Publish"
                  : "Save draft"}
          </button>
        </>
      }
    >
      <div className="eng-form-grid">
        <Field label="Type">
          <select
            className="eng-select"
            value={form.type}
            onChange={set("type")}
          >
            <option value="NEWS">News</option>
            <option value="BLOG">Blog</option>
          </select>
        </Field>
        <Field label="Author">
          <input
            className="eng-input"
            value={form.author}
            onChange={set("author")}
            maxLength={80}
          />
        </Field>
        <Field label="Title" full>
          <input
            className="eng-input"
            value={form.title}
            onChange={set("title")}
            maxLength={200}
            placeholder="Article headline"
          />
        </Field>
        <Field
          label="Short summary"
          hint="Shown on the list in the mobile app (max 400 characters)."
          full
        >
          <textarea
            className="eng-textarea"
            style={{ minHeight: 60 }}
            value={form.excerpt}
            onChange={set("excerpt")}
            maxLength={400}
          />
        </Field>
        <Field label="Cover image" full as="div">
          <ImageUploader
            value={form.coverImage}
            onChange={(url) => setForm((f) => ({ ...f, coverImage: url }))}
            onError={onError}
          />
        </Field>
        <Field
          label="Article content"
          hint="Plain text or HTML. Blank lines create new paragraphs."
          full
        >
          <textarea
            className="eng-textarea"
            style={{ minHeight: 220 }}
            value={form.content}
            onChange={set("content")}
          />
        </Field>
        <Field label="Tags" hint="Comma separated, e.g. announcement, safety">
          <input
            className="eng-input"
            value={form.tags}
            onChange={set("tags")}
          />
        </Field>
        <Field label="Publish date" hint="A future date schedules the article.">
          <input
            className="eng-input"
            type="datetime-local"
            value={form.publishedAt}
            onChange={set("publishedAt")}
          />
        </Field>
        <label className="eng-check">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={set("isPublished")}
          />
          Published (visible in the mobile app)
        </label>
        {!editing || !post.notifiedAt ? (
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
            Commuters were notified on {formatDate(post.notifiedAt)}.
          </span>
        )}
      </div>
    </Modal>
  );
}

function AdminPosts() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, showNotice] = useNotice();

  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      try {
        const res = await api.get("/engagement/posts/admin/all", {
          params: {
            page: nextPage,
            limit: 15,
            type: type || undefined,
            status: status || undefined,
            q: search || undefined,
          },
        });
        const data = res.data?.data || {};
        setItems((prev) =>
          nextPage > 1 ? [...prev, ...(data.items || [])] : data.items || [],
        );
        setTotal(data.total || 0);
        setHasMore(!!data.hasMore);
        setPage(nextPage);
      } catch (error) {
        showNotice("error", errMsg(error, "Could not load articles."));
      } finally {
        setLoading(false);
      }
    },
    [type, status, search, showNotice],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const openEditor = async (post) => {
    if (!post) return setEditing({});
    try {
      const res = await api.get(`/engagement/posts/admin/${post._id}`);
      setEditing(res.data?.data?.post || post);
    } catch (error) {
      showNotice("error", errMsg(error, "Could not open the article."));
    }
  };

  const onSaved = (post, wasEditing) => {
    setEditing(null);
    showNotice(
      "success",
      wasEditing
        ? "Article updated."
        : post?.isPublished
          ? "Article published."
          : "Draft saved.",
    );
    load(1);
  };

  const togglePublish = async (post) => {
    try {
      await api.put(`/engagement/posts/${post._id}`, {
        isPublished: !post.isPublished,
      });
      showNotice(
        "success",
        post.isPublished ? "Moved to drafts." : "Article published.",
      );
      load(1);
    } catch (error) {
      showNotice("error", errMsg(error));
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/engagement/posts/${removing._id}`);
      setRemoving(null);
      showNotice("success", "Article deleted.");
      load(1);
    } catch (error) {
      showNotice("error", errMsg(error));
    } finally {
      setBusy(false);
    }
  };

  const statusPill = (post) =>
    !post.isPublished ? (
      <Pill tone="muted">Draft</Pill>
    ) : new Date(post.publishedAt) > new Date() ? (
      <Pill tone="warning">Scheduled</Pill>
    ) : (
      <Pill tone="success">Live</Pill>
    );

  return (
    <div className="eng-wrap">
      <Notice notice={notice} />
      <div className="eng-toolbar">
        <form
          className="eng-toolbar"
          style={{ margin: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
        >
          <input
            className="eng-input"
            placeholder="Search title, summary or tag"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search articles"
          />
          <select
            className="eng-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            <option value="NEWS">News</option>
            <option value="BLOG">Blog</option>
          </select>
          <select
            className="eng-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </form>
        <span className="grow" />
        <button
          type="button"
          className="eng-btn primary"
          onClick={() => openEditor(null)}
        >
          New article
        </button>
      </div>

      <div className="eng-table-card">
        {loading && !items.length ? (
          <div className="eng-empty">Loading articles...</div>
        ) : !items.length ? (
          <div className="eng-empty">
            No articles yet. Create one and it will appear in the mobile app
            News & Blog screen.
          </div>
        ) : (
          <table className="eng-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Type</th>
                <th>Status</th>
                <th>Publish date</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((post) => (
                <tr key={post._id}>
                  <td>
                    <div className="title-cell">
                      {post.coverImage ? (
                        <img className="thumb" src={post.coverImage} alt="" />
                      ) : (
                        <span className="thumb" />
                      )}
                      <div>
                        <b>{post.title}</b>
                        <small>{post.author}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Pill tone={post.type === "NEWS" ? "teal" : "info"}>
                      {post.type === "NEWS" ? "News" : "Blog"}
                    </Pill>
                  </td>
                  <td>{statusPill(post)}</td>
                  <td>{formatDate(post.publishedAt)}</td>
                  <td>
                    <div className="eng-actions">
                      <button
                        type="button"
                        className="eng-btn ghost small"
                        onClick={() => togglePublish(post)}
                      >
                        {post.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className="eng-btn ghost small"
                        onClick={() => openEditor(post)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="eng-btn danger-ghost small"
                        onClick={() => setRemoving(post)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {hasMore ? (
          <div className="eng-pager">
            <button
              type="button"
              className="eng-btn ghost"
              onClick={() => load(page + 1)}
              disabled={loading}
            >
              {loading
                ? "Loading..."
                : `Load more (${items.length} of ${total})`}
            </button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <PostForm
          post={editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onError={(m) => showNotice("error", m)}
        />
      ) : null}
      {removing ? (
        <ConfirmModal
          title="Delete article"
          message={`"${removing.title}" will be permanently removed from the mobile app.`}
          busy={busy}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

export default AdminPosts;
