import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../../../src/components/Screen";
import { PartnerHeader, StatTile } from "../../../src/components/partner";
import { Badge, Card, Loading } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { partnerService } from "../../../src/services/partner";
import { formatDateNumeric, formatMoney } from "../../../src/utils/format";
import { colors, radius, type } from "../../../src/theme";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const ACTIONS = [
  { icon: "add-circle-outline", label: "New Route", href: "/partner/add-route" },
  { icon: "calendar-outline", label: "Schedules", href: "/partner/schedules" },
  { icon: "car-sport-outline", label: "Fleet", href: "/partner/fleet" },
  { icon: "trending-up-outline", label: "Earnings", href: "/partner/earnings" },
];

const renewalBadge = (s) =>
  s === "expired" ? { label: "Expired", tone: "danger" } : s === "active" ? { label: "Active", tone: "success" } : { label: "Due soon", tone: "warning" };

export default function PartnerHome() {
  const router = useRouter();
  const { user } = useAuth();

  const stats = useQuery({ queryKey: ["partner", "stats"], queryFn: partnerService.dashboardStats });
  const renewals = useQuery({ queryKey: ["partner", "renewals"], queryFn: partnerService.renewals });

  const s = stats.data?.stats || {};
  const money = (v) => formatMoney(v, s.currency || "AED").replace(/\.00(?= )/, "");
  const dueRenewals = (renewals.data?.data?.renewals || []).filter((r) => r.renewalStatus !== "active").slice(0, 3);
  const pendingRequests = s.pendingRouteRequests ?? 0;

  return (
    <Screen
      header={<PartnerHeader />}
      tabBarSpace
      refreshing={stats.isRefetching || renewals.isRefetching}
      onRefresh={() => Promise.all([stats.refetch(), renewals.refetch()])}
    >
      <View style={styles.greet}>
        <Text style={type.small}>{greeting()},</Text>
        <Text style={[type.h1, { fontSize: 24 }]} numberOfLines={1}>
          {user?.fullName?.split(" ")[0] || "Partner"}
        </Text>
      </View>

      {stats.isLoading ? (
        <Loading />
      ) : (
        <>
          <Card style={styles.revenue}>
            <Text style={styles.revenueLabel}>This month</Text>
            <Text style={styles.revenueValue} numberOfLines={1} adjustsFontSizeToFit>
              {money(s.monthlyRevenue || 0)}
            </Text>
            <Pressable onPress={() => router.push("/partner/earnings")} hitSlop={8} style={styles.row}>
              <Text style={styles.revenueLink}>View earnings</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </Pressable>
          </Card>

          <View style={styles.grid}>
            <StatTile icon="location-outline" value={s.activeRoutes ?? 0} label="Active routes" onPress={() => router.push("/partner/routes")} style={styles.half} />
            <StatTile icon="people-outline" tint={colors.success} soft={colors.successSoft} value={s.activeSubscribers ?? 0} label="Subscribers" onPress={() => router.push("/partner/bookings")} style={styles.half} />
            <StatTile icon="bus-outline" tint={colors.info} soft={colors.infoSoft} value={s.upcomingTrips ?? 0} label="Upcoming trips" onPress={() => router.push("/partner/trips")} style={styles.half} />
            <StatTile icon="refresh-outline" tint={colors.warning} soft={colors.warningSoft} value={s.renewalsPending ?? 0} label="Renewals due" style={styles.half} />
          </View>

          {pendingRequests > 0 ? (
            <Pressable onPress={() => router.push("/partner/requests")} style={styles.alert} accessibilityRole="button">
              <Ionicons name="chatbox-ellipses" size={20} color={colors.tealDark} />
              <Text style={styles.alertText}>
                {pendingRequests} new route request{pendingRequests === 1 ? "" : "s"} from commuters
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.tealDark} />
            </Pressable>
          ) : null}

          <Text style={[type.h3, styles.section]}>Quick actions</Text>
          <View style={styles.actions}>
            {ACTIONS.map((a) => (
              <Pressable key={a.href} onPress={() => router.push(a.href)} style={styles.action} accessibilityRole="button">
                <View style={styles.actionIcon}>
                  <Ionicons name={a.icon} size={22} color={colors.tealDark} />
                </View>
                <Text style={styles.actionLabel} numberOfLines={1}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {dueRenewals.length > 0 ? (
            <>
              <Text style={[type.h3, styles.section]}>Renewals needing attention</Text>
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {dueRenewals.map((r, i) => {
                  const b = renewalBadge(r.renewalStatus);
                  return (
                    <View key={r.passId} style={[styles.renewal, i > 0 && styles.divider]}>
                      <View style={{ flex: 1 }}>
                        <Text style={type.h3} numberOfLines={1}>
                          {r.passenger?.name || r.passenger?.email || "Passenger"}
                        </Text>
                        <Text style={type.small} numberOfLines={1}>
                          Ends {formatDateNumeric(r.endDate)}
                        </Text>
                      </View>
                      <Badge label={b.label} tone={b.tone} />
                    </View>
                  );
                })}
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greet: { marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  revenue: { backgroundColor: colors.navy, padding: 20, borderRadius: radius.xl ?? 24, marginBottom: 16, gap: 4 },
  revenueLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
  revenueValue: { color: "#fff", fontSize: 30, fontWeight: "800" },
  revenueLink: { color: "#fff", fontWeight: "700", fontSize: 13, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  half: { width: "47.8%" },
  alert: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.tealSoft, marginBottom: 8 },
  alertText: { flex: 1, color: colors.navy, fontWeight: "700", fontSize: 14 },
  section: { marginTop: 12, marginBottom: 10 },
  actions: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  action: { width: "23%", alignItems: "center", gap: 6 },
  actionIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  actionLabel: { fontSize: 12, fontWeight: "600", color: colors.navy },
  renewal: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
