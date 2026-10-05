import { useQuery, useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { spacing, useTheme } from "@/src/theme";
import { Btn, Card, Empty, Field, Header, Loading, Row, T, useToast } from "@/src/ui";

// Live Convex screen: reads and writes the `products` table on the Convex
// deployment via Convex React hooks (useQuery/useMutation). It is intentionally
// standalone so it demonstrates the Convex data layer without touching the
// existing FastAPI-backed flows.
export default function ConvexCheck() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const products = useQuery(api.products.list, token ? { token } : "skip");
  const create = useMutation(api.products.create);
  const remove = useMutation(api.products.remove);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!token) return toast("سجّل الدخول كمالك أولاً", "error");
    if (!name.trim()) return toast("أدخل اسم المنتج", "error");
    setBusy(true);
    try {
      await create({ token, name: name.trim(), sale_price: +price || 0 });
      setName("");
      setPrice("");
      toast("أُضيف إلى Convex ✓");
    } catch (e: any) {
      toast(e.message ?? "فشل", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="convex-check-screen">
      <Header title="فحص Convex" subtitle="تُقرأ وتُكتب المنتجات مباشرة من قاعدة بيانات Convex" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card style={{ gap: spacing.md, borderColor: colors.brandPrimary }}>
          <T v="h2">إضافة منتج (Convex mutation)</T>
          <Field testID="cc-name-input" label="اسم المنتج" value={name} onChangeText={setName} />
          <Field testID="cc-price-input" label="سعر البيع" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
          <Btn testID="cc-add-button" title="إضافة عبر Convex" icon="add" loading={busy} onPress={add} />
        </Card>

        <T v="h2">المنتجات (Convex useQuery · تحديث حيّ)</T>
        {products === undefined ? (
          <Loading />
        ) : products.length === 0 ? (
          <Empty icon="cube-outline" text="لا توجد منتجات في Convex بعد" />
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {products.map((p: any) => (
              <Row
                key={p.id}
                testID={`cc-row-${p.id}`}
                icon="cube-outline"
                title={p.name}
                subtitle={p.category || "—"}
                right={<T v="label">{money(p.sale_price)}</T>}
                onPress={() => token && remove({ token, id: p.id }).catch((e: any) => toast(e.message, "error"))}
              />
            ))}
          </Card>
        )}
        <T v="caption" color="muted">اضغط على أي منتج لحذفه (Convex mutation). القائمة تتحدّث تلقائياً.</T>
        <Btn testID="cc-back-button" variant="ghost" title="رجوع" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}
