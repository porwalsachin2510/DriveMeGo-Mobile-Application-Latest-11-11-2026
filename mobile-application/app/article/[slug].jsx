import { useCallback, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { AppHeader } from "../../src/components/AppHeader";
import { HtmlContent } from "../../src/components/HtmlContent";
import { errorMessage } from "../../src/components/SubScreen";
import { Button, EmptyState, Loading } from "../../src/components/ui";
import { engagementService } from "../../src/services";
import { formatDateLong } from "../../src/utils/format";
import { colors, type } from "../../src/theme";

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Admins may write plain text or HTML. Plain text becomes paragraphs.
const toHtml = (content = "") => {
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return content;
  return content
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("");
};

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await engagementService.post(slug);
      setPost(res?.data?.post || null);
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
            {post.type === "NEWS" ? "News" : "Blog"} · {formatDateLong(post.publishedAt)}
          </Text>
          <Text style={[type.h1, { marginTop: 6, lineHeight: 31 }]}>{post.title}</Text>
          {post.author ? <Text style={[type.small, { marginTop: 6 }]}>By {post.author}</Text> : null}
          <View style={{ marginTop: 16 }}>
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
          <View style={{ marginTop: 20 }}>
            <Button title="Share" variant="outline" onPress={() => Share.share({ message: post.title }).catch(() => {})} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", height: 200, borderRadius: 20, backgroundColor: colors.tealSoft, marginBottom: 16 },
  meta: { fontSize: 12.5, fontWeight: "700", color: colors.tealDark },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  tag: { fontSize: 12.5, fontWeight: "700", color: colors.tealDark, backgroundColor: colors.tealSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
});
