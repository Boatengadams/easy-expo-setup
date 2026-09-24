import { View, Text, StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome BAGS</Text>
      <Text style={styles.subtitle}>Your app is set up and ready. Start editing this screen to build your project.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  subtitle: { fontSize: 16, textAlign: "center", opacity: 0.7 },
});
