import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SubScreen, errorMessage } from "../src/components/SubScreen";
import { SheetModal } from "../src/components/forms";
import { Badge, Button, Card, Chip, EmptyState, Field, Loading } from "../src/components/ui";
import { engagementService } from "../src/services";
import { formatDate, formatDateTime } from "../src/utils/format";
import { colors } from "../src/theme";

const PHASE = {
  LIVE: { label: "Live", tone: "success" },
  UPCOMING: { label: "Upcoming", tone: "warning" },
  ENDED: { label: "Ended", tone: "muted" },
};

const FILTERS = [
  { key: "", label: "All" },
  { key: "LIVE", label: "Live" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "JOINED", label: "My entries" },
  { key: "ENDED", label: "Past" },
];

const timeLeft = (endsAt) => {
  const ms = new Date(endsAt) - Date.now();
  if (ms <= 0) return "Ended";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.max(Math.floor((ms % 3600000) / 60000), 1);
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
};

function EntrySheet({ contest, onClose, onJoined }) {
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  if (!contest) return null;

  const isQuiz = contest.entryType === "QUIZ";
  const isAnswer = contest.entryType === "ANSWER";
  const ready = isQuiz ? selected !== null : isAnswer ? answer.trim().length >= 2 : true;

  const submit = async () => {
    setSaving(true);
    try {
      const payload = isQuiz ? { selectedOption: selected } : isAnswer ? { answer: answer.trim() } : {};
      const res = await engagementService.joinContest(contest._id, payload);
      onJoined(res?.message || "You're in. Good luck!");
    } catch (e) {
      Alert.alert("Could not join", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetModal
      visible
      onClose={onClose}
      title={isQuiz || isAnswer ? "Enter contest" : "Join contest"}
      footer={<Button title="Submit entry" onPress={submit} loading={saving} disabled={!ready} />}
    >
      <View style={{ gap: 12 }}>
        <Text style={styles.sheetTitle}>{contest.title}</Text>
        {contest.question ? <Text style={styles.question}>{contest.question}</Text> : null}
        {isQuiz ? (
          <View style={{ gap: 8 }} accessibilityRole="radiogroup">
            {(contest.options || []).map((opt, i) => {
              const on = selected === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => setSelected(i)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[styles.option, on && styles.optionOn]}
                >
                  <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.tealDark : colors.subtle} />
                  <Text style={styles.optionText}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : isAnswer ? (
          <Field placeholder="Your answer" value={answer} onChangeText={setAnswer} multiline maxLength={500} accessibilityLabel="Your answer" />
        ) : (
          <Text style={styles.desc}>Tap submit to enter. Winners are picked at random after the contest ends.</Text>
        )}
        {contest.terms ? <Text style={styles.terms}>By entering you agree to: {contest.terms}</Text> : null}
      </View>
    </SheetModal>
  );
}

export default function ContestsScreen() {
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [entering, setEntering] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(
    async (isRefresh) => {
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        const res = await engagementService.contests(filter ? { status: filter } : undefined);
        setItems(res?.data?.items || []);
      } catch (e) {
        setError(errorMessage(e, "Could not load contests."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter]
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const changeFilter = (key) => {
    setLoading(true);
    setFilter(key);
  };

  const onJoined = async (message) => {
    setEntering(null);
    Alert.alert("You're in", message);
    await load(false);
  };

  return (
    <SubScreen title="Contests" refreshing={refreshing} onRefresh={() => load(true)}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.label} label={f.label} active={filter === f.key} onPress={() => changeFilter(f.key)} />
        ))}
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState icon="alert-circle-outline" title="Something went wrong" message={error} action={<Button title="Try again" onPress={() => load(false)} />} />
      ) : !items.length ? (
        filter === "JOINED" ? (
          <EmptyState icon="ticket-outline" title="No entries yet" message="Join a live contest for a chance to win." />
        ) : (
          <EmptyState icon="trophy-outline" title="No contests here" message="New contests are announced here. Check back soon." />
        )
      ) : (
        <View style={{ gap: 14 }}>
          {items.map((c) => {
            const phase = PHASE[c.phase] || PHASE.ENDED;
            const expanded = openId === c._id;
            const hasDetails = !!c.description || !!c.rules?.length || !!c.terms;
            const full = !!c.maxEntries && c.entries >= c.maxEntries;
            return (
              <Card key={c._id} style={styles.card}>
                {c.coverImage ? <Image source={{ uri: c.coverImage }} style={styles.cover} contentFit="cover" /> : null}
                <View style={styles.body}>
                  <View style={styles.head}>
                    <Text style={styles.title}>{c.title}</Text>
                    {c.won ? <Badge label="You won" tone="success" icon="trophy" /> : <Badge label={phase.label} tone={phase.tone} />}
                  </View>
                  {c.prize ? (
                    <View style={styles.prize}>
                      <Ionicons name="gift-outline" size={17} color={colors.tealDark} />
                      <Text style={styles.prizeText} numberOfLines={2}>
                        {c.prize}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.facts}>
                    <Text style={styles.fact}>
                      {c.phase === "UPCOMING" ? `Starts ${formatDateTime(c.startsAt)}` : c.phase === "LIVE" ? timeLeft(c.endsAt) : `Ended ${formatDate(c.endsAt)}`}
                    </Text>
                    <Text style={styles.fact}>
                      {c.entries || 0}
                      {c.maxEntries ? `/${c.maxEntries}` : ""} entered
                    </Text>
                    <Text style={styles.fact}>
                      {c.maxWinners || 1} {c.maxWinners === 1 ? "winner" : "winners"}
                    </Text>
                  </View>

                  {expanded ? (
                    <View style={{ gap: 8 }}>
                      {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
                      {c.rules?.map((r, i) => (
                        <Text key={i} style={styles.rule}>
                          {"\u2022"} {r}
                        </Text>
                      ))}
                      {c.terms ? <Text style={styles.terms}>{c.terms}</Text> : null}
                    </View>
                  ) : null}

                  {hasDetails ? (
                    <Pressable onPress={() => setOpenId(expanded ? null : c._id)} accessibilityRole="button" accessibilityState={{ expanded }} hitSlop={8}>
                      <Text style={styles.toggle}>{expanded ? "Hide details" : "Details & rules"}</Text>
                    </Pressable>
                  ) : null}

                  {c.winners?.length ? (
                    <View style={styles.winners}>
                      <Ionicons name="trophy-outline" size={16} color={colors.warning} />
                      <Text style={styles.winnersText}>Winners: {c.winners.join(", ")}</Text>
                    </View>
                  ) : c.phase === "ENDED" ? (
                    <Text style={styles.fact}>Winners will be announced soon.</Text>
                  ) : null}

                  {c.joined ? (
                    <View style={{ gap: 6 }}>
                      <Badge label={c.won ? "Winner" : "You're entered"} tone="teal" icon="checkmark-circle" />
                      {c.myEntry?.answer ? <Text style={styles.fact}>Your answer: {c.myEntry.answer}</Text> : null}
                      {c.myEntry?.selectedOption !== undefined && c.myEntry?.selectedOption !== null && c.options?.[c.myEntry.selectedOption] ? (
                        <Text style={styles.fact}>Your pick: {c.options[c.myEntry.selectedOption]}</Text>
                      ) : null}
                    </View>
                  ) : c.phase === "LIVE" ? (
                    full ? (
                      <Badge label="Entries full" tone="muted" />
                    ) : (
                      <Button title="Join contest" small onPress={() => setEntering(c)} />
                    )
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <EntrySheet key={entering?._id || "none"} contest={entering} onClose={() => setEntering(null)} onJoined={onJoined} />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  card: { padding: 0, overflow: "hidden" },
  cover: { width: "100%", height: 140, backgroundColor: colors.tealSoft },
  body: { padding: 16, gap: 10 },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  title: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.navy },
  prize: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.tealTint },
  prizeText: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.navy },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4 },
  fact: { fontSize: 12.5, color: colors.muted },
  desc: { fontSize: 13.5, lineHeight: 19, color: colors.muted },
  rule: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  terms: { fontSize: 12, color: colors.subtle, lineHeight: 17 },
  toggle: { fontSize: 13, fontWeight: "800", color: colors.tealDark },
  winners: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.warningSoft },
  winnersText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.navy },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.navy },
  question: { fontSize: 15, fontWeight: "700", color: colors.text, lineHeight: 21 },
  option: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  optionOn: { borderColor: colors.tealDark, backgroundColor: colors.tealTint },
  optionText: { flex: 1, fontSize: 14, color: colors.text },
});
