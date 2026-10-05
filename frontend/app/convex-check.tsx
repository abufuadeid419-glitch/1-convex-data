import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { spacing, useTheme } from "@/src/theme";
import { Btn, Card, Empty, Field, Header, Loading, Row, Stat, T, useToast } from "@/src/ui";

// Live Convex dashboard. Reads the owner overview + agent leaderboard and the
// products list straight from the Convex deployment via Convex React hooks
// (useQuery) and writes via useMutation. It first mirrors the current (already
// authenticated) session into Convex so the same bearer token authenticates
// Convex functions — see convex/auth.ts. Standalone so it never touches the
// existing FastAPI-backed flows.
export default function ConvexCheck() {
  const { colors } = useTheme();
  const { token, user } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const syncSession = useMutation(api.auth.syncSession);
  const [ready, setReady] = useState(false);
  const synced = useRef(false);

  useEffect(() => {
    if (!token || !user || synced.current) return;
    synced.current = true;
    syncSession({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name ?? null,
        picture: user.picture ?? null,
        role: user.role ?? null,
        employee_type: user.employee_type ?? null,
        org_id: user.org_id ?? null,
      },
      org: user.org ?? null,
    })
      .then(() => setReady(true))
      .catch((e: any) => toast(e.message ?? "فشل مزامنة الجلسة", "error"));
  }, [token, user, syncSession, toast]);

  const arg = ready && token ? { token } : "skip";
  const overview = useQuery(api.stats.overview, arg);
  const board = useQuery(api.stats.leaderboard, arg);
  const products = useQuery(api.products.list, arg);
  const create = useMutation(api.products.create);
  const remove = useMutation(api.products.remove);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!token) return toast("سجّل الدخول أولاً", "error");
    if (!name.trim()) return toast("أدخل اسم المنتج", "error");
    setBusy(true);
    try {
      await create({ token, name: name.trim(), sale_price: +price || 0 });
      setName("");
      setPrice("");
      toast("أُضيف إلى Convex ✓ — لاحظ تحديث البطاقات فوراً");
    } catch (e: any) {
      toast(e.message ?? "فشل", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="convex-check-screen">
      <Header title="لوحة Convex الحيّة" subtitle="الأرقام تُقرأ من Convex وتتحدّث لحظياً" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {!ready || overview === undefined ? (
          <Loading />
        ) : (
          <>
            <T v="h2">نظرة عامة (stats.overview)</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              <Stat testID="cc-stat-sales" icon="cash-outline" label="إجمالي المبيعات" value={money(overview.sales_total)} tone="brand" />
              <Stat testID="cc-stat-today" icon="today-outline" label="مبيعات اليوم" value={money(overview.today_sales)} tone="info" />
              <Stat icon="wallet-outline" label="التحصيلات" value={money(overview.collections_total)} tone="success" />
              <Stat icon="alert-circle-outline" label="الديون" value={money(overview.debts_total)} tone="error" />
              {overview.gross_profit != null && (
                <Stat icon="trending-up-outline" label="الربح الإجمالي" value={money(overview.gross_profit)} tone="success" />
              )}
              <Stat icon="layers-outline" label="قيمة المخزون" value={money(overview.stock_value)} tone="info" />
              <Stat testID="cc-stat-products" icon="cube-outline" label="المنتجات" value={String(overview.products)} tone="brand" />
              <Stat icon="people-outline" label="العملاء" value={String(overview.customers)} tone="info" />
            </View>

            <T v="h2">ترتيب الموزعين (stats.leaderboard · {board?.month ?? "—"})</T>
            {board === undefined ? (
              <Loading />
            ) : board.agents.length === 0 ? (
              <Empty icon="trophy-outline" text="لا يوجد موزعون بعد" />
            ) : (
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {board.agents.map((a: any) => (
                  <Row
                    key={a.user_id}
                    icon="person-outline"
                    title={`#${a.rank} · ${a.name || a.email}`}
                    subtitle={`${a.sales_count} فاتورة · تحصيل ${money(a.collections_total)}`}
                    right={<T v="label">{money(a.sales_total)}</T>}
                  />
                ))}
              </Card>
            )}

            <T v="h2">إضافة منتج (Convex mutation)</T>
            <Card style={{ gap: spacing.md, borderColor: colors.brandPrimary }}>
              <Field testID="cc-name-input" label="اسم المنتج" value={name} onChangeText={setName} />
              <Field testID="cc-price-input" label="سعر البيع" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
              <Btn testID="cc-add-button" title="إضافة عبر Convex" icon="add" loading={busy} onPress={add} />
            </Card>

            <T v="h2">المنتجات (products.list · حيّ)</T>
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
            <T v="caption" color="muted">اضغط على أي منتج لحذفه. كل البطاقات أعلاه تتحدّث تلقائياً عبر Convex.</T>
          </>
        )}
        <Btn testID="cc-back-button" variant="ghost" title="رجوع" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}
