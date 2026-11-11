import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { CitySheet } from "../../src/components/CitySheet";
import { engagementService } from "../../src/services";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { AppHeader, resolveImage } from "../../src/components/AppHeader";
import { Card } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { initials } from "../../src/utils/format";
import { colors, radius, type } from "../../src/theme";

const COUNTRIES = {
  UAE: "Dubai, UAE",
  KW: "Kuwait City, Kuwait",
  SA: "Riyadh, Saudi Arabia",
  BH: "Manama, Bahrain",
  OM: "Muscat, Oman",
  QA: "Doha, Qatar",
};

function Row({ icon, title, sub, onPress, last, danger }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { backgroundColor: colors.tealTint }]}>
      <View style={[styles.rowIcon, danger && { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: colors.danger }]}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );
}

export default function MoreTab() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const avatar = resolveImage(user?.profileImage);
  const [cityInfo, setCityInfo] = useState(null);
  const [cityOpen, setCityOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      engagementService
        .city()
        .then((res) => setCityInfo(res?.data || null))
        .catch(() => setCityInfo(null));
    }, [])
  );

  const cityLabel = cityInfo?.selected
    ? `${cityInfo.selected}, ${cityInfo.countryName}`
    : COUNTRIES[user?.country] || user?.country || "Dubai, UAE";

  const confirmLogout = () =>
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);

  return (
    <Screen header={<AppHeader />} tabBarSpace decor>
      <Pressable onPress={() => router.push("/profile")} accessibilityRole="button">
        <Card style={styles.profile}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials(user?.fullName)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={type.h2} numberOfLines={1}>
              {user?.fullName || "Your Profile"}
            </Text>
            <View style={styles.editRow}>
              <Ionicons name="pencil" size={12} color={colors.tealDark} />
              <Text style={styles.editText}>Edit Profile</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.navy} />
        </Card>
      </Pressable>

      <Card style={styles.city}>
        <View style={styles.rowIcon}>
          <Ionicons name="location" size={22} color={colors.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.small}>Current City</Text>
          <Text style={type.h3}>{cityLabel}</Text>
        </View>
        <Pressable onPress={() => cityInfo && setCityOpen(true)} style={styles.change} accessibilityRole="button" accessibilityLabel="Change city">
          <Text style={styles.changeText}>Change</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.tealDark} />
        </Pressable>
      </Card>

      <Card style={styles.group}>
        <Row icon="time-outline" title="Travel History" onPress={() => router.push("/travel-history")} />
        <Row icon="ribbon-outline" title="Subscriptions" onPress={() => router.push("/subscriptions")} />
        <Row icon="chatbox-ellipses-outline" title="Route Requests" onPress={() => router.push("/route-requests")} />
        <Row icon="notifications-outline" title="Notifications" onPress={() => router.push("/notifications")} />
        <Row icon="settings-outline" title="Settings" onPress={() => router.push("/settings")} last />
      </Card>

      <Card style={styles.group}>
        <Row icon="person-add-outline" title="Refer a Friend" onPress={() => router.push("/refer")} />
        <Row icon="shield-checkmark-outline" title="Secure your trip" onPress={() => router.push("/secure-trip")} />
        <Row icon="call-outline" title="Emergency Contacts" onPress={() => router.push("/emergency-contacts")} />
        <Row icon="newspaper-outline" title="News & Blog" onPress={() => router.push("/news")} />
        <Row icon="trophy-outline" title="Contests" onPress={() => router.push("/contests")} />
        <Row icon="create-outline" title="Write Feedback" onPress={() => router.push("/feedback")} />
        <Row icon="help-circle-outline" title="FAQs" onPress={() => router.push("/faqs")} last />
      </Card>

      <Card style={styles.group}>
        <Row icon="document-text-outline" title="Terms & Conditions" onPress={() => router.push("/page/terms-and-conditions")} />
        <Row icon="shield-checkmark-outline" title="Privacy Policy" onPress={() => router.push("/page/privacy-policy")} />
        <Row icon="information-circle-outline" title="About Us" onPress={() => router.push("/page/about-us")} />
        <Row icon="mail-outline" title="Contact Us" onPress={() => router.push("/page/contact-us")} last />
      </Card>

      <Card style={styles.group}>
        <Row icon="log-out-outline" title="Log out" onPress={confirmLogout} danger last />
      </Card>

      {cityInfo ? (
        <CitySheet
          visible={cityOpen}
          onClose={() => setCityOpen(false)}
          countryName={cityInfo.countryName}
          cities={cityInfo.cities}
          selected={cityInfo.selected}
          onChanged={(selected) => setCityInfo((prev) => ({ ...prev, selected }))}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, marginBottom: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "800", color: colors.tealDark },
  editRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  editText: { fontSize: 13, fontWeight: "700", color: colors.tealDark },
  city: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 14 },
  change: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.tealSoft },
  changeText: { fontSize: 13, fontWeight: "800", color: colors.tealDark },
  group: { padding: 0, marginBottom: 14, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, fontWeight: "800", color: colors.navy },
  rowSub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
});
