import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { Button, Chip, EmptyState, Loading } from "../src/components/ui";
import { engagementService } from "../src/services";
import { formatDate } from "../src/utils/format";
import { colors, radius, shadow } from "../src/theme";

const TABS = [
  { key: "", label: "All" },
  { key: "NEWS", label: "News" },
  { key: "BLOG", label: "Blog" },
];

const typeLabel = (t) => (t === "NEWS" ? "News" : "Blog");

export default function NewsScreen() {
  const router = useRouter();
  const [type, setType] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async ({ nextPage = 1, nextType = type, refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else if (nextPage > 1) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const res = await engagementService.posts({ page: nextPage, limit: 10, type: nextType || undefined });
        const data = res?.data || {};
        setItems((prev) => (nextPage > 1 ? [...prev, ...(data.items || [])] : data.items || []));
        setPage(nextPage);
        setHasMore(!!data.hasMore);
      } catch (e) {
        setError(errorMessage(e, "Could not load articles."));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [type]
  );

  useFocusEffect(
    useCallback(() => {
      load({ nextPage: 1 });
    }, [load])
  );

  const open = (post) => router.push({ pathname: "/article/[slug]", params: { slug: post.slug } });
  const [lead, ...rest] = items;

  return (
    <SubScreen title="News & Blog" refreshing={refreshing} onRefresh={() => load({ refresh: true })}>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Chip
            key={t.label}
            label={t.label}
            active={type === t.key}
            onPress={() => {
              setType(t.key);
              load({ nextPage: 1, nextType: t.key });
            }}
          />
        ))}
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} action={<Button title="Try again" onPress={() => load({ nextPage: 1 })} />} />
      ) : !items.length ? (
        <EmptyState icon="newspaper-outline" title="Nothing published yet" message="Check back soon for news and travel tips." />
      ) : (
        <View style={{ gap: 12 }}>
          <Pressable onPress={() => open(lead)} accessibilityRole="button" style={[styles.lead, shadow]}>
            {lead.coverImage ? <Image source={{ uri: lead.coverImage }} style={styles.leadCover} contentFit="cover" /> : null}
            <View style={styles.leadBody}>
              <Text style={styles.meta}>
                {typeLabel(lead.type)} · {formatDate(lead.publishedAt)}
              </Text>
              <Text style={styles.leadTitle} numberOfLines={3}>
                {lead.title}
              </Text>
              {lead.excerpt ? (
                <Text style={styles.excerpt} numberOfLines={2}>
                  {lead.excerpt}
                </Text>
              ) : null}
            </View>
          </Pressable>

          {rest.map((p) => (
            <Pressable key={p._id} onPress={() => open(p)} accessibilityRole="button" style={[styles.row, shadow]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.meta}>
                  {typeLabel(p.type)} · {formatDate(p.publishedAt)}
                </Text>
                <Text style={styles.rowTitle} numberOfLines={3}>
                  {p.title}
                </Text>
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
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  lead: { backgroundColor: colors.card, borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  leadCover: { width: "100%", height: 170, backgroundColor: colors.tealSoft },
  leadBody: { padding: 16, gap: 6 },
  leadTitle: { fontSize: 19, fontWeight: "800", color: colors.navy, lineHeight: 25 },
  excerpt: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  meta: { fontSize: 12, fontWeight: "700", color: colors.tealDark },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  rowTitle: { fontSize: 15.5, fontWeight: "800", color: colors.navy, lineHeight: 21, marginTop: 4 },
  thumb: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.tealSoft },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
});
