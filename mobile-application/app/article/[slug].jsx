import { useCallback, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { AppHeader } from "../../src/components/AppHeader";
import { HtmlContent } from "../../src/components/HtmlContent";
import { errorMessage } from "../../src/components/SubScreen";
import { Button, EmptyState, Field, Loading } from "../../src/components/ui";
import { engagementService } from "../../src/services";
import { formatDate, formatDateLong, formatDateTime } from "../../src/utils/format";
import { colors, type } from "../../src/theme";
import { CATEGORY_LABELS } from "../../src/utils/posts";

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Admins may write plain text or HTML. Plain text becomes paragraphs.
const toHtml = (content = "") => {
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return content;
  return content
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("");
};

function ActionButton({ icon, label, active, activeColor = colors.tealDark, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      accessibilityLabel={label}
      style={[styles.action, active && { borderColor: activeColor, backgroundColor: colors.tealTint }]}
      hitSlop={6}
    >
      <Ionicons name={icon} size={18} color={active ? activeColor : colors.muted} />
      <Text style={[styles.actionText, active && { color: activeColor }]}>{label}</Text>
    </Pressable>
  );
}

function Comments({ post, onCountChange }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(
    async (nextPage = 1) => {
      try {
        const res = await engagementService.postComments(post._id, { page: nextPage, limit: 20 });
        const data = res?.data || {};
        setItems((prev) => (nextPage > 1 ? [...prev, ...(data.items || [])] : data.items || []));
        setPage(nextPage);
        setHasMore(!!data.hasMore);
      } catch {
        // Comments are secondary; the article stays readable if they fail.
      } finally {
        setLoading(false);
      }
    },
    [post._id]
  );

  useFocusEffect(
    useCallback(() => {
      load(1);
    }, [load])
  );

  const send = async () => {
    const text = body.trim();
    if (text.length < 2 || sending) return;
    setSending(true);
    try {
      const res = await engagementService.addComment(post._id, text);
      const comment = res?.data?.comment;
      if (comment) {
        setItems((prev) => [comment, ...prev]);
        onCountChange(1);
      }
      setBody("");
    } catch (e) {
      Alert.alert("Could not post comment", errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const remove = (comment) =>
    Alert.alert("Delete comment?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await engagementService.deleteComment(comment._id);
            setItems((prev) => prev.filter((c) => c._id !== comment._id));
            onCountChange(-1);
          } catch (e) {
            Alert.alert("Could not delete", errorMessage(e));
          }
        },
      },
    ]);

  return (
    <View style={styles.comments}>
      <Text style={styles.sectionTitle}>Comments ({post.commentCount || 0})</Text>
      {post.allowComments === false ? (
        <Text style={styles.muted}>Comments are turned off for this article.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          <Field
            placeholder="Share your thoughts"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
            accessibilityLabel="Write a comment"
          />
          <Button title="Post comment" small icon="send" loading={sending} disabled={body.trim().length < 2} onPress={send} />
        </View>
      )}

      {loading ? (
        <Loading />
      ) : !items.length ? (
        post.allowComments === false ? null : <Text style={styles.muted}>Be the first to comment.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {items.map((c) => (
            <View key={c._id} style={styles.comment}>
              {c.user?.profileImage ? (
                <Image source={{ uri: c.user.profileImage }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Text style={styles.avatarText}>{(c.user?.fullName || "U").charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.commentHead}>
                  <Text style={styles.commentName} numberOfLines={1}>
                    {c.user?.fullName || "Commuter"}
                  </Text>
                  <Text style={styles.commentTime}>{formatDateTime(c.createdAt)}</Text>
                </View>
                <Text style={styles.commentBody}>{c.body}</Text>
                {c.mine ? (
                  <Pressable onPress={() => remove(c)} accessibilityRole="button" hitSlop={8}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          {hasMore ? <Button title="Load more comments" variant="outline" small onPress={() => load(page + 1)} /> : null}
        </View>
      )}
    </View>
  );
}

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await engagementService.post(slug);
      setPost(res?.data?.post || null);
      setRelated(res?.data?.related || []);
    } catch (e) {
      setError(errorMessage(e, "This article is not available."));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/news"));

  const toggle = async (kind) => {
    if (!post || busy) return;
    setBusy(kind);
    const prev = post;
    // Optimistic update keeps the tap responsive; the server result wins.
    if (kind === "like") setPost({ ...post, liked: !post.liked, likeCount: Math.max((post.likeCount || 0) + (post.liked ? -1 : 1), 0) });
    else setPost({ ...post, bookmarked: !post.bookmarked });
    try {
      const res = kind === "like" ? await engagementService.likePost(post._id) : await engagementService.bookmarkPost(post._id);
      const data = res?.data || {};
      setPost((p) =>
        kind === "like" ? { ...p, liked: !!data.active, likeCount: data.count ?? p.likeCount } : { ...p, bookmarked: !!data.active }
      );
    } catch (e) {
      setPost(prev);
      Alert.alert("Something went wrong", errorMessage(e));
    } finally {
      setBusy("");
    }
  };

  const share = () =>
    Share.share({ message: post.excerpt ? `${post.title}\n\n${post.excerpt}` : post.title }).catch(() => {});

  return (
    <Screen header={<AppHeader onBack={goBack} />}>
      {loading ? (
        <Loading />
      ) : error || !post ? (
        <EmptyState icon="alert-circle-outline" title="Article unavailable" message={error} action={<Button title="Try again" onPress={load} />} />
      ) : (
        <View>
          {post.coverImage ? <Image source={{ uri: post.coverImage }} style={styles.cover} contentFit="cover" /> : null}
          <Text style={styles.meta}>
            {post.type === "NEWS" ? "News" : "Blog"}
            {post.category ? ` · ${CATEGORY_LABELS[post.category] || post.category}` : ""} · {formatDateLong(post.publishedAt)}
          </Text>
          <Text style={[type.h1, { marginTop: 6, lineHeight: 31 }]}>{post.title}</Text>
          <Text style={[type.small, { marginTop: 6 }]}>
            {post.author ? `By ${post.author} · ` : ""}
            {post.readMinutes || 1} min read · {post.views || 0} views
          </Text>

          <View style={styles.actions}>
            <ActionButton
              icon={post.liked ? "heart" : "heart-outline"}
              label={`${post.likeCount || 0}`}
              active={post.liked}
              activeColor={colors.danger}
              onPress={() => toggle("like")}
              disabled={busy === "like"}
            />
            <ActionButton
              icon={post.bookmarked ? "bookmark" : "bookmark-outline"}
              label={post.bookmarked ? "Saved" : "Save"}
              active={post.bookmarked}
              onPress={() => toggle("bookmark")}
              disabled={busy === "bookmark"}
            />
            <ActionButton icon="share-social-outline" label="Share" onPress={share} />
          </View>

          <View style={{ marginTop: 8 }}>
            <HtmlContent html={toHtml(post.content)} />
          </View>
          {post.tags?.length ? (
            <View style={styles.tags}>
              {post.tags.map((t) => (
                <Text key={t} style={styles.tag}>
                  #{t}
                </Text>
              ))}
            </View>
          ) : null}

          {related.length ? (
            <View style={styles.related}>
              <Text style={styles.sectionTitle}>Keep reading</Text>
              {related.map((r) => (
                <Pressable
                  key={r._id}
                  onPress={() => router.push({ pathname: "/article/[slug]", params: { slug: r.slug } })}
                  accessibilityRole="button"
                  style={styles.relatedRow}
                >
                  {r.coverImage ? (
                    <Image source={{ uri: r.coverImage }} style={styles.relatedThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.relatedThumb, styles.avatarEmpty]}>
                      <Ionicons name="newspaper-outline" size={18} color={colors.tealDark} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.relatedTitle} numberOfLines={2}>
                      {r.title}
                    </Text>
                    <Text style={styles.commentTime}>{formatDate(r.publishedAt)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Comments post={post} onCountChange={(d) => setPost((p) => ({ ...p, commentCount: Math.max((p.commentCount || 0) + d, 0) }))} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 200, borderRadius: 20, backgroundColor: colors.tealSoft, marginBottom: 16 },
  meta: { fontSize: 12.5, fontWeight: "700", color: colors.tealDark },
  actions: { flexDirection: "row", gap: 10, marginVertical: 16 },
  action: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  actionText: { fontSize: 13.5, fontWeight: "700", color: colors.muted },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  tag: { fontSize: 12.5, fontWeight: "700", color: colors.tealDark, backgroundColor: colors.tealSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.navy },
  related: { marginTop: 28, gap: 12 },
  relatedRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  relatedThumb: { width: 60, height: 60, borderRadius: 12, backgroundColor: colors.tealSoft },
  relatedTitle: { fontSize: 14.5, fontWeight: "700", color: colors.navy, lineHeight: 20 },
  comments: { marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border, gap: 14 },
  muted: { fontSize: 13.5, color: colors.muted, lineHeight: 20 },
  comment: { flexDirection: "row", gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tealSoft },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "800", color: colors.tealDark },
  commentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  commentName: { flex: 1, fontSize: 13.5, fontWeight: "800", color: colors.navy },
  commentTime: { fontSize: 11.5, color: colors.subtle },
  commentBody: { fontSize: 14, color: colors.text, lineHeight: 20 },
  deleteText: { fontSize: 12.5, fontWeight: "700", color: colors.danger, marginTop: 4 },
});
