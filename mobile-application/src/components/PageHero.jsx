import { StyleSheet, Text, View } from "react-native";
import { type } from "../theme";

export function PageHero({ title, subtitle, right }) {
  return (
    <View style={styles.hero}>
      <View style={{ flex: 1 }}>
        <Text style={type.h1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[type.small, { marginTop: 4 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 4, paddingBottom: 18 },
});

