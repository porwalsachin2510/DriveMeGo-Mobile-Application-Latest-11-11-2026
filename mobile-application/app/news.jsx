import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { Button, Chip, EmptyState, Field, Loading } from "../src/components/ui";
import { engagementService } from "../src/services";
import { formatDate } from "../src/utils/format";
import { CATEGORY_LABELS } from "../src/utils/posts";
import { colors, radius, shadow } from "../src/theme";

const TABS = [
  { key: "", label: "All" },
  { key: "NEWS", label: "News" },
  { key: "BLOG", label: "Blog" },
  { key: "SAVED", label: "Saved", icon: "bookmark-outline" },
];

const typeLabel = (t) => (t === "NEWS" ? "News" : "Blog");

function Meta({ post }) {
  return (
    <Text style={styles.meta} numberOfLines={1}>
      {CATEGORY_LABELS[post.category] || typeLabel(post.type)} · {formatDate(post.publishedAt)}
      {post.readMinutes ? ` · ${post.readMinutes} min read` : ""}
    </Text>
  );
}

function Stats({ post }) {
  return (
    <View style={styles.stats}>
      <Ionicons name={post.liked ? "heart" : "heart-outline"} size={14} color={post.liked ? colors.danger : colors.subtle} />
      <Text style={styles.statText}>{post.likeCount || 0}</Text>
      <Ionicons name="chatbubble-outline" size={13} color={colors.subtle} />
      <Text style={styles.statText}>{post.commentCount || 0}</Text>
      {post.bookmarked ? <Ionicons name="bookmark" size={13} color={colors.tealDark} /> : null}
    </View>
  );
}

export default function NewsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async ({ nextPage = 1, refresh = false } = {}) => {
      const id = ++requestId.current;
      if (refresh) setRefreshing(true);
      else if (nextPage > 1) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const params = { page: nextPage, limit: 10 };
        if (tab === "SAVED") params.saved = "true";
        else if (tab) params.type = tab;
        if (category) params.category = category;
        if (search) params.q = search;
        const res = await engagementService.posts(params);
        if (id !== requestId.current) return;
        const data = res?.data || {};
        setItems((prev) => (nextPage > 1 ? [...prev, ...(data.items || [])] : data.items || []));
        setPage(nextPage);
        setHasMore(!!data.hasMore);
      } catch (e) {
        if (id === requestId.current) setError(errorMessage(e, "Could not load articles."));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [tab, category, search]
  );

  useFocusEffect(
    useCallback(() => {
      load({ nextPage: 1 });
    }, [load])
  );

  const open = (post) => router.push({ pathname: "/article/[slug]", params: { slug: post.slug } });
  const filtered = !!(search || category || tab === "SAVED");
  const [lead, ...rest] = filtered ? [null, ...items] : items;

  return (
    <SubScreen title="News & Blog" refreshing={refreshing} onRefresh={() => load({ refresh: true })}>
      <Field
        icon="search-outline"
        placeholder="Search articles"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel="Search articles"
        containerStyle={{ marginBottom: 12 }}
      />

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Chip key={t.label} label={t.label} icon={t.icon} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats} style={{ marginBottom: 16 }}>
        <Chip label="All topics" active={!category} onPress={() => setCategory("")} />
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <Chip key={key} label={label} active={category === key} onPress={() => setCategory(category === key ? "" : key)} />
        ))}
      </ScrollView>

      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} action={<Button title="Try again" onPress={() => load({ nextPage: 1 })} />} />
      ) : !items.length ? (
        tab === "SAVED" ? (
          <EmptyState icon="bookmark-outline" title="No saved articles" message="Tap the bookmark on any article to read it later." />
        ) : filtered ? (
          <EmptyState icon="search-outline" title="No matches" message="Try a different keyword or topic." />
        ) : (
          <EmptyState icon="newspaper-outline" title="Nothing published yet" message="Check back soon for news and travel tips." />
        )
      ) : (
        <View style={{ gap: 12 }}>
          {lead ? (
            <Pressable onPress={() => open(lead)} accessibilityRole="button" style={[styles.lead, shadow]}>
              {lead.coverImage ? <Image source={{ uri: lead.coverImage }} style={styles.leadCover} contentFit="cover" /> : null}
              <View style={styles.leadBody}>
                <View style={styles.leadTop}>
                  {lead.isFeatured ? (
                    <Text style={styles.featured}>Featured</Text>
                  ) : null}
                  <Meta post={lead} />
                </View>
                <Text style={styles.leadTitle} numberOfLines={3}>
                  {lead.title}
                </Text>
                {lead.excerpt ? (
                  <Text style={styles.excerpt} numberOfLines={2}>
                    {lead.excerpt}
                  </Text>
                ) : null}
                <Stats post={lead} />
              </View>
            </Pressable>
          ) : null}

          {rest.map((p) => (
            <Pressable key={p._id} onPress={() => open(p)} accessibilityRole="button" style={[styles.row, shadow]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Meta post={p} />
                <Text style={styles.rowTitle} numberOfLines={3}>
                  {p.title}
                </Text>
                <Stats post={p} />
              </View>
              {p.coverImage ? (
                <Image source={{ uri: p.coverImage }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="newspaper-outline" size={22} color={colors.tealDark} />
                </View>
              )}
            </Pressable>
          ))}

          {hasMore ? <Button title="Load more" variant="outline" loading={loadingMore} onPress={() => load({ nextPage: page + 1 })} /> : null}
        </View>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  cats: { gap: 8, paddingRight: 8 },
  lead: { backgroundColor: colors.card, borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  leadCover: { width: "100%", height: 180, backgroundColor: colors.tealSoft },
  leadBody: { padding: 16, gap: 6 },
  leadTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  featured: { fontSize: 11, fontWeight: "800", color: colors.white, backgroundColor: colors.tealDark, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  leadTitle: { fontSize: 19, fontWeight: "800", color: colors.navy, lineHeight: 25 },
  excerpt: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  meta: { flexShrink: 1, fontSize: 12, fontWeight: "700", color: colors.tealDark },
  stats: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statText: { fontSize: 12, color: colors.subtle, marginRight: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  rowTitle: { fontSize: 15.5, fontWeight: "800", color: colors.navy, lineHeight: 21 },
  thumb: { width: 80, height: 80, borderRadius: radius.md, backgroundColor: colors.tealSoft },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
});
