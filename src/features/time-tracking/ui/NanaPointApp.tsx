"use client";

import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CoffeeRoundedIcon from "@mui/icons-material/CoffeeRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import LocalHospitalRoundedIcon from "@mui/icons-material/LocalHospitalRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import type { Session } from "@supabase/supabase-js";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  formatDatePtBr,
  formatDateFullPtBr,
  formatMonthPtBr,
  formatTimePtBr,
  formatWeekdayLongPtBr,
  formatWeekdayShortPtBr,
  minutesToHoursLabel,
  toDateKey,
} from "@/domain/time/format";
import { isCompletedWithoutDailyTarget } from "@/domain/time/calculations";
import type {
  BreakCategory,
  BreakEntry,
  DailySummary,
  TimeEntry,
} from "@/domain/time/types";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  fadeUp,
  motionDuration,
  motionEasing,
  springy,
  staggerContainer,
} from "@/shared/motion/presets";
import { nanaColors } from "@/shared/theme/nana-theme";
import { upsertUserProfile } from "../data/time-tracking-repository";
import { useTimeTracker } from "../model/use-time-tracker";

type Tab = "today" | "calendar" | "bank" | "history" | "profile";

const bottomAppNavigationItems: ReadonlyArray<{
  accent: string;
  icon: ReactNode;
  label: string;
  value: Tab;
}> = [
  { value: "today", label: "Hoje", icon: <HomeRoundedIcon />, accent: "#ffe45c" },
  {
    value: "calendar",
    label: "Calendário",
    icon: <CalendarMonthRoundedIcon />,
    accent: "#78c9f2",
  },
  { value: "bank", label: "Banco", icon: <SavingsRoundedIcon />, accent: "#e579ef" },
  {
    value: "history",
    label: "Histórico",
    icon: <InsightsRoundedIcon />,
    accent: "#6ee7b7",
  },
  { value: "profile", label: "Perfil", icon: <PersonRoundedIcon />, accent: "#ffffff" },
];

type EditTarget =
  | { kind: "time"; entry: TimeEntry }
  | { kind: "break"; entry: BreakEntry };

type AddRecordTarget =
  | { kind: "time"; date: string }
  | { kind: "break"; date: string };

type HistoryLimitFilter =
  | "all"
  | "exceeded"
  | "negative"
  | "pending"
  | "complete"
  | "edited"
  | "holiday"
  | "excluded"
  | "medical_leave";

const actionLabels: Record<TimeEntry["type"], string> = {
  arrival: "Cheguei no trabalho",
  lunch_start: "Sair para almoço",
  lunch_end: "Voltei do almoço",
  break_start: "Iniciar pausa",
  break_end: "Finalizar pausa",
  departure: "Encerrar expediente",
};

const statusLabels = {
  not_started: "Ainda não comecei",
  working: "Trabalhando",
  at_lunch: "Em almoço",
  on_break: "Em pausa",
  closed: "Expediente encerrado",
  incomplete: "Registro pendente",
};

const breakLabels: Record<BreakCategory, string> = {
  lunch: "Almoço",
  medical: "Médico",
  sick: "Doença",
  travel: "Viagem",
  personal: "Pessoal",
  other: "Outro",
};

const MotionCard = motion.create(Card);

function getDisplayName(session: Session | null) {
  const metadataName = session?.user.user_metadata?.display_name;

  if (typeof metadataName === "string" && metadataName.trim().length > 0) {
    return metadataName.trim();
  }

  const emailName = session?.user.email?.split("@")[0];
  return emailName || "usuária";
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function getGreetingForDate(date: Date) {
  const hour = date.getHours();

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function toDateInputValue(isoDate: string) {
  return toDateKey(new Date(isoDate));
}

function toTimeInputValue(isoDate: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function toEditableIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function recordMatchesSearch(
  day: DailySummary,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  const haystack = [
    formatDatePtBr(day.date),
    formatWeekdayLongPtBr(day.date),
    statusLabels[day.status],
    day.mark?.type === "holiday" ? "feriado" : "",
    day.mark?.type === "excluded" ? "dia limpo ignorado removido contabilização" : "",
    day.mark?.type === "medical_leave"
      ? "atestado médico declaração médica ausência justificada consulta médica"
      : "",
    day.mark?.note ?? "",
    ...day.entries.flatMap((entry) => [
      actionLabels[entry.type],
      entry.note ?? "",
      formatTimePtBr(entry.occurredAt),
    ]),
    ...day.breaks.flatMap((entry) => [
      breakLabels[entry.category],
      entry.note ?? "",
      formatTimePtBr(entry.startsAt),
      entry.endsAt ? formatTimePtBr(entry.endsAt) : "",
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function canCloseEntriesDirectly(entries: TimeEntry[]) {
  const hasArrival = entries.some((entry) => entry.type === "arrival");
  const hasDeparture = entries.some((entry) => entry.type === "departure");

  return hasArrival && !hasDeparture;
}

function createCounterChars(value: string) {
  return value.split("").map((char, index) => ({
    id: `${index}-${char}`,
    char,
    index,
  }));
}

function minutesToClockDisplay(minutes: number) {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function RollingCounter({ value, label }: { value: string; label?: string }) {
  const chars = useMemo(() => createCounterChars(value), [value]);

  return (
    <Stack spacing={0.5}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 0.3,
          px: 1.2,
          py: 0.6,
          borderRadius: "12px",
          bgcolor: "rgba(255, 255, 255, 0.9)",
          boxShadow: "inset 0 0 0 1px rgba(148, 163, 184, 0.28)",
          width: "fit-content",
        }}
      >
        {chars.map((token) => (
          <AnimatePresence initial={false} mode="popLayout" key={token.index}>
            <motion.span
              key={token.id}
              initial={{ y: "42%", opacity: 0, filter: "blur(6px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: "-42%", opacity: 0, filter: "blur(6px)" }}
              transition={{
                duration: motionDuration.medium,
                ease: motionEasing.standard,
                delay: token.index * 0.02,
              }}
              style={{
                display: "inline-block",
                minWidth: token.char === ":" ? 7 : 13,
                textAlign: "center",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "clamp(1.8rem, 7vw, 2.7rem)",
                fontWeight: 850,
                lineHeight: 1,
                color: "#0f172a",
              }}
            >
              {token.char}
            </motion.span>
          </AnimatePresence>
        ))}
      </Box>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
      )}
    </Stack>
  );
}

function buildBalanceSeries(values: number[]) {
  if (values.length === 0) return [0];

  const cumulative: number[] = [];
  let running = 0;

  for (const value of values.slice(-8)) {
    running += value;
    cumulative.push(running);
  }

  return cumulative;
}

function BalanceFlowChart({
  values,
  positive,
}: {
  values: number[];
  positive: boolean;
}) {
  if (values.length < 2) {
    return (
      <Box
        sx={{
          height: 72,
          borderRadius: "14px",
          border: "1px dashed rgba(148, 163, 184, 0.4)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Sem serie historica
        </Typography>
      </Box>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Box sx={{ position: "relative", height: 78 }}>
      <svg
        aria-label="Fluxo do banco de horas"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        <motion.polyline
          fill="none"
          points={points}
          stroke={positive ? "#16a34a" : "#e11d48"}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: motionDuration.chart, ease: motionEasing.emphasized }}
        />
      </svg>
    </Box>
  );
}

export function NanaPointApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(() => hasSupabaseConfig());
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [directCloseDate, setDirectCloseDate] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [addTarget, setAddTarget] = useState<AddRecordTarget | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const supabase = hasSupabaseConfig() ? getSupabaseBrowserClient() : null;
  const tracker = useTimeTracker({
    supabase,
    userId: session?.user.id ?? null,
  });

  useEffect(() => {
    if (!hasSupabaseConfig()) return;

    const client = getSupabaseBrowserClient();

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);

      if (event === "SIGNED_IN" && nextSession) {
        const now = new Date().toISOString();
        queueMicrotask(() => {
          void upsertUserProfile(client, {
            id: nextSession.user.id,
            displayName: getDisplayName(nextSession),
            lastLoginAt: now,
            lastSeenAt: now,
          });
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;

    void upsertUserProfile(supabase, {
      id: session.user.id,
      displayName: getDisplayName(session),
      lastSeenAt: new Date().toISOString(),
    });
  }, [session, supabase]);

  async function logout() {
    if (hasSupabaseConfig()) {
      await getSupabaseBrowserClient().auth.signOut();
    }

    setSession(null);
  }

  if (authLoading) {
    return <CenteredLoading label="Carregando Nana's Point..." />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  const displayName = getDisplayName(session);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#f3efe5",
        pb: "calc(92px + env(safe-area-inset-bottom))",
      }}
    >
      <Container
        maxWidth={tab === "calendar" ? "lg" : "sm"}
        sx={{ px: { xs: 1.25, sm: 2 }, py: { xs: 1.75, sm: 2.5 } }}
      >
        <BrandHeader />

        <AnimatePresence mode="wait">
          <motion.main
            key={tab}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.28 }}
          >
            {tab === "today" && (
              <TodayView
                displayName={displayName}
                tracker={tracker}
                onOpenEntry={() => setEntryDialogOpen(true)}
                onOpenBreak={() => setBreakDialogOpen(true)}
                onOpenDirectClose={() => setDirectCloseDate(tracker.todayKey)}
              />
            )}
            {tab === "calendar" && (
              <CalendarView
                tracker={tracker}
                onAddBreak={(date) => setAddTarget({ kind: "break", date })}
                onAddTime={(date) => setAddTarget({ kind: "time", date })}
                onEdit={setEditTarget}
                onOpenDirectClose={setDirectCloseDate}
                onCompleteDay={tracker.completeDayWithoutDebit}
                onToggleHoliday={tracker.toggleHoliday}
                onToggleExcludedDay={tracker.toggleExcludedDay}
                onToggleMedicalLeave={tracker.toggleMedicalLeave}
              />
            )}
            {tab === "bank" && <HourBankView tracker={tracker} />}
            {tab === "history" && (
              <HistoryView
                tracker={tracker}
                onAddBreak={(date) => setAddTarget({ kind: "break", date })}
                onAddTime={(date) => setAddTarget({ kind: "time", date })}
                onEdit={setEditTarget}
                onOpenDirectClose={setDirectCloseDate}
                onToggleExcludedDay={tracker.toggleExcludedDay}
                onToggleMedicalLeave={tracker.toggleMedicalLeave}
              />
            )}
            {tab === "profile" && (
              <ProfileView
                displayName={displayName}
                session={session}
                onLogout={logout}
              />
            )}
          </motion.main>
        </AnimatePresence>
      </Container>

      <BottomAppNavigation
        tab={tab}
        shouldReduceMotion={Boolean(shouldReduceMotion)}
        onChange={setTab}
      />
      <EntryDialog
        open={entryDialogOpen}
        onClose={() => setEntryDialogOpen(false)}
        nextType={tracker.nextEntryType}
        date={tracker.todayKey}
        onSubmit={tracker.addTimeEntry}
      />
      <BreakDialog
        open={breakDialogOpen}
        onClose={() => setBreakDialogOpen(false)}
        date={tracker.todayKey}
        onSubmit={tracker.addBreak}
      />
      <DirectCloseDayDialog
        key={directCloseDate ?? "direct-close-closed"}
        open={Boolean(directCloseDate)}
        date={directCloseDate ?? tracker.todayKey}
        onClose={() => setDirectCloseDate(null)}
        onSubmit={tracker.addTimeEntry}
      />
      <EditRecordDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmitTime={tracker.editTimeEntry}
        onSubmitBreak={tracker.editBreak}
      />
      <AddRecordDialog
        target={addTarget}
        onClose={() => setAddTarget(null)}
        onSubmitTime={tracker.addTimeEntry}
        onSubmitBreak={tracker.addBreak}
      />
    </Box>
  );
}

function CenteredLoading({ label }: { label: string }) {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(145deg, #fff4df 0%, #f3fbef 100%)",
      }}
    >
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <CircularProgress color="secondary" />
        <Typography color="text.secondary">{label}</Typography>
      </Stack>
    </Box>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function getEmailRedirectTo() {
    if (typeof window === "undefined") {
      return undefined;
    }

    return `${window.location.origin}/`;
  }

  async function submit() {
    if (!hasSupabaseConfig()) {
      setError("O acesso ainda não está disponível. Tente novamente mais tarde.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    const client = getSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "login") {
        const { error: authError } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (authError) throw authError;
        return;
      }

      const { error: signUpError } = await client.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getEmailRedirectTo(),
          data: {
            display_name: name.trim() || normalizedEmail.split("@")[0],
          },
        },
      });

      if (signUpError) throw signUpError;

      setFeedback(
        "Cadastro criado. Se aparecer uma confirmação por e-mail, é só confirmar para entrar.",
      );
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Não foi possível concluir. Confira os dados e tente novamente.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        p: 2,
        background:
          "linear-gradient(145deg, #fff4df 0%, #f3fbef 58%, #ffffff 100%)",
      }}
    >
      <MotionCard
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={springy}
        sx={{ width: "100%", maxWidth: 430 }}
      >
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Box>
              <Chip label="Seu ponto com segurança" color="secondary" />
              <Typography variant="h3" sx={{ mt: 2 }}>
                Nana&apos;s Point
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Entre para registrar seus horários, acompanhar pausas e cuidar do seu
                banco de horas com tranquilidade.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant={mode === "login" ? "contained" : "outlined"}
                onClick={() => setMode("login")}
              >
                Entrar
              </Button>
              <Button
                fullWidth
                variant={mode === "signup" ? "contained" : "outlined"}
                onClick={() => setMode("signup")}
              >
                Criar cadastro
              </Button>
            </Stack>

            <Stack spacing={1.5}>
              {mode === "signup" && (
                <TextField
                  label="Nome"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  fullWidth
                />
              )}
              <TextField
                label="E-mail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                fullWidth
              />
              <TextField
                label="Senha"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                helperText={mode === "signup" ? "Use pelo menos 6 caracteres." : undefined}
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
              {feedback && <Alert severity="success">{feedback}</Alert>}
              {!hasSupabaseConfig() && (
                <Alert severity="warning">
                  O acesso ainda não está disponível. Tente novamente mais tarde.
                </Alert>
              )}
              <Button
                size="large"
                variant="contained"
                disabled={!email || !password || isSubmitting || !hasSupabaseConfig()}
                onClick={submit}
              >
                {isSubmitting
                  ? "Aguarde..."
                  : mode === "login"
                    ? "Entrar"
                    : "Criar minha conta"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </MotionCard>
    </Box>
  );
}

function BrandHeader() {
  return (
    <Box
      component={motion.header}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionDuration.medium, ease: motionEasing.standard }}
      sx={{
        display: "flex",
        justifyContent: "flex-start",
        mb: 1.55,
        px: { xs: 0.1, sm: 0.2 },
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          bgcolor: "#050505",
          border: "1px solid #2f3137",
          borderRadius: "999px",
          boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.16), 0 1px 2px rgba(60,64,67,0.18)",
          color: "#ffffff",
          display: "inline-flex",
          gap: 1.1,
          minHeight: 34,
          pl: 1.55,
          pr: 0.35,
        }}
      >
        <Typography
          sx={{
            color: "#ffffff",
            fontSize: "0.78rem",
            fontWeight: 850,
            letterSpacing: 0,
            lineHeight: 1,
          }}
        >
          Nana&apos;s Point
        </Typography>
        <Box
          sx={{
            alignItems: "center",
            bgcolor: "#ffffff",
            border: "1px solid rgba(255,255,255,0.72)",
            borderRadius: "50%",
            color: "#111827",
            display: "flex",
            height: 27,
            justifyContent: "center",
            width: 27,
          }}
        >
          <AppsRoundedIcon sx={{ fontSize: 18 }} />
        </Box>
      </Box>
    </Box>
  );
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), 100));
}

type HomeProgressChartDay = {
  date: string;
  label: string;
  summary: DailySummary | null;
};

function buildProgressChartPoints(values: number[], maxValue: number) {
  const width = 218;
  const height = 104;
  const insetX = 12;
  const insetY = 14;
  const drawableWidth = width - insetX * 2;
  const drawableHeight = height - insetY * 2;

  return values
    .map((value, index) => {
      const x = insetX + (index / Math.max(values.length - 1, 1)) * drawableWidth;
      const y = insetY + (1 - value / maxValue) * drawableHeight;

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function ActivityProgressLineChart({
  days,
  todayKey,
}: {
  days: HomeProgressChartDay[];
  todayKey: string;
}) {
  const series = [
    {
      color: "#10b981",
      label: "Créditos",
      values: days.map((day) => Math.max(day.summary?.balanceMinutes ?? 0, 0) / 60),
    },
    {
      color: "#ef4444",
      label: "Débitos",
      values: days.map((day) => Math.max(-(day.summary?.balanceMinutes ?? 0), 0) / 60),
    },
    {
      color: "#78c9f2",
      label: "Pausas",
      values: days.map((day) => day.summary?.breaks.length ?? 0),
    },
    {
      color: "#e579ef",
      label: "Atestados",
      values: days.map((day) => (day.summary?.mark?.type === "medical_leave" ? 1 : 0)),
    },
    {
      color: "#facc15",
      label: "Faltas",
      values: days.map((day) => {
        const daySummary = day.summary;
        const hasActivity = Boolean(
          daySummary &&
            (daySummary.entries.length > 0 ||
              daySummary.breaks.length > 0 ||
              daySummary.mark),
        );

        return day.date < todayKey && !hasActivity ? 1 : 0;
      }),
    },
  ];
  const maxValue = Math.max(1, ...series.flatMap((item) => item.values));
  const activeIndex = Math.max(
    0,
    days.findIndex((day) => day.date === todayKey),
  );

  return (
    <Box
      sx={{
        bgcolor: "#ffffff",
        border: "1px solid #eceef4",
        borderRadius: "18px",
        boxShadow: "0 12px 28px rgba(28, 37, 65, 0.045)",
        minWidth: { sm: 232 },
        overflow: "hidden",
        p: 1,
        width: { xs: "100%", sm: 232 },
      }}
    >
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mb: 0.7 }}>
        {series.map((item) => (
          <Stack
            direction="row"
            key={item.label}
            spacing={0.45}
            sx={{ alignItems: "center" }}
          >
            <Box sx={{ bgcolor: item.color, borderRadius: "50%", height: 7, width: 7 }} />
            <Typography sx={{ color: "#5f6673", fontSize: "0.64rem", fontWeight: 820 }}>
              {item.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Box sx={{ height: 104, position: "relative" }}>
        <svg
          aria-label="Linhas semanais de créditos, débitos, faltas, pausas e atestados"
          viewBox="0 0 218 104"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          {days.map((day, index) => {
            const x = 12 + (index / Math.max(days.length - 1, 1)) * 194;

            return (
              <line
                key={day.date}
                x1={x}
                x2={x}
                y1="10"
                y2="96"
                stroke={index === activeIndex ? "#d1d5db" : "#e8ebf1"}
                strokeDasharray="4 5"
                strokeWidth={index === activeIndex ? 1.4 : 1}
              />
            );
          })}
          <polyline
            fill="none"
            points="12,96 206,96"
            stroke="#f0f2f6"
            strokeWidth="1"
          />
          {series.map((item, index) => (
            <motion.polyline
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              key={item.label}
              points={buildProgressChartPoints(item.values, maxValue)}
              animate={{ pathLength: 1, opacity: 1 }}
              stroke={item.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={index < 2 ? 3 : 2.2}
              transition={{
                delay: index * 0.08,
                duration: motionDuration.slow,
                ease: motionEasing.emphasized,
              }}
            />
          ))}
          {days.map((day, index) => {
            if (day.date !== todayKey) return null;

            const value = series[0].values[index] || series[1].values[index] || 0;
            const x = 12 + (index / Math.max(days.length - 1, 1)) * 194;
            const y = 14 + (1 - value / maxValue) * 76;

            return (
              <circle
                cx={x}
                cy={Number.isFinite(y) ? y : 90}
                fill="#ffffff"
                key={`${day.date}-marker`}
                r="5.5"
                stroke="#111827"
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.2 }}>
        {days.map((day) => (
          <Typography
            key={day.date}
            sx={{
              color: day.date === todayKey ? "#111827" : "#8a909b",
              fontSize: "0.61rem",
              fontWeight: day.date === todayKey ? 900 : 780,
              textTransform: "uppercase",
            }}
          >
            {day.label.slice(0, 1)}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

function TodayView({
  displayName,
  tracker,
  onOpenEntry,
  onOpenBreak,
  onOpenDirectClose,
}: {
  displayName: string;
  tracker: ReturnType<typeof useTimeTracker>;
  onOpenEntry: () => void;
  onOpenBreak: () => void;
  onOpenDirectClose: () => void;
}) {
  const summary = tracker.todaySummary;
  const buttonLabel =
    tracker.nextEntryType && tracker.nextEntryType !== "pause"
      ? actionLabels[tracker.nextEntryType]
      : "Dia registrado";
  const bankLabel = tracker.hasHourBankMovements
    ? minutesToHoursLabel(tracker.hourBankBalance)
    : "Sem saldo";
  const isBankPositive = tracker.hourBankBalance >= 0;
  const showDirectClose =
    tracker.canCloseDayDirectly && tracker.nextEntryType !== "departure";
  const primaryActionClosesDay = tracker.nextEntryType === "departure";
  const [selectedDateOverride, setSelectedDateOverride] = useState<string | null>(null);
  const selectedDate = selectedDateOverride ?? summary.date;
  const monthSummaries = tracker.dailySummaries;
  const summariesByDate = useMemo(
    () => new Map(monthSummaries.map((day) => [day.date, day])),
    [monthSummaries],
  );
  const completedDays = monthSummaries.filter(
    (day) => day.status === "closed" || isCompletedWithoutDailyTarget(day),
  ).length;
  const activeDays = monthSummaries.filter(
    (day) => day.entries.length > 0 || day.breaks.length > 0 || Boolean(day.mark),
  ).length;
  const selectedDay =
    summariesByDate.get(selectedDate) ??
    tracker.historySummaries.find((day) => day.date === selectedDate) ?? {
      date: selectedDate,
      status: "not_started" as const,
      workedMinutes: 0,
      breakMinutes: 0,
      balanceMinutes: 0,
      entries: [],
      breaks: [],
    };
  const selectedDateReference = useMemo(
    () => new Date(`${selectedDate}T12:00:00`),
    [selectedDate],
  );
  const weekStart = useMemo(() => {
    const monday = new Date(selectedDateReference);
    const weekday = monday.getDay();
    const distanceFromMonday = weekday === 0 ? 6 : weekday - 1;
    monday.setDate(monday.getDate() - distanceFromMonday);
    monday.setHours(12, 0, 0, 0);
    return monday;
  }, [selectedDateReference]);
  const weekStrip = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + index);
        const dayKey = toDateKey(day);
        return {
          date: dayKey,
          label: formatWeekdayShortPtBr(dayKey),
          day: day.getDate(),
          summary: summariesByDate.get(dayKey) ?? null,
        };
      }),
    [summariesByDate, weekStart],
  );
  const selectedTimelineMoments = [
    ...selectedDay.entries.map((entry) => entry.occurredAt),
    ...selectedDay.breaks.flatMap((entry) =>
      entry.endsAt ? [entry.startsAt, entry.endsAt] : [entry.startsAt],
    ),
  ].sort((first, second) => first.localeCompare(second));
  const selectedRangeLabel =
    selectedTimelineMoments.length > 0
      ? `${formatTimePtBr(selectedTimelineMoments[0])} - ${formatTimePtBr(selectedTimelineMoments[selectedTimelineMoments.length - 1])}`
      : "Sem horários registrados";
  const selectedBreakLabel =
    selectedDay.breaks.length > 0
      ? `${selectedDay.breaks.length} pausa${selectedDay.breaks.length > 1 ? "s" : ""}`
      : "Sem pausas";
  const selectedWorkedLabel = minutesToHoursLabel(selectedDay.workedMinutes);
  const isPrimaryActionAvailable = tracker.nextEntryType && tracker.nextEntryType !== "pause";
  const primaryButtonLabel =
    tracker.nextEntryType === "arrival"
      ? "Iniciar dia"
      : primaryActionClosesDay
        ? "Encerrar dia"
        : buttonLabel;
  const primaryActionTone =
    tracker.nextEntryType === "arrival"
      ? {
          bgcolor: "#0f9f6e",
          border: "transparent",
          boxShadow: "0 10px 22px rgba(15, 159, 110, 0.24)",
          color: "#ffffff",
          hoverBg: "#0b8d63",
          hoverShadow: "0 12px 26px rgba(15, 159, 110, 0.3)",
          iconColor: "#ffffff",
        }
      : primaryActionClosesDay
        ? {
            bgcolor: "#050505",
            border: "#050505",
            boxShadow: "0 10px 22px rgba(5, 5, 5, 0.18)",
            color: "#ffffff",
            hoverBg: "#111827",
            hoverShadow: "0 12px 26px rgba(5, 5, 5, 0.24)",
            iconColor: "#6ee7b7",
          }
        : tracker.nextEntryType === "lunch_start"
          ? {
              bgcolor: "#ffffff",
              border: "#dadce0",
              boxShadow: "0 1px 2px rgba(60, 64, 67, 0.08)",
              color: "#111827",
              hoverBg: "#f8fafd",
              hoverShadow: "0 4px 12px rgba(60, 64, 67, 0.12)",
              iconColor: "#ef4444",
            }
          : {
              bgcolor: "#ffffff",
              border: "#bae6fd",
              boxShadow: "0 8px 18px rgba(56, 189, 248, 0.08)",
              color: "#111827",
              hoverBg: "#f0f9ff",
              hoverShadow: "0 10px 22px rgba(56, 189, 248, 0.12)",
              iconColor: "#0284c7",
            };
  const statusChipLabel =
    summary.status === "not_started"
      ? "Aguardando início"
      : statusLabels[summary.status];
  const firstName = getFirstName(displayName);
  const greeting = getGreetingForDate(tracker.today);
  const todayProgress = clampPercent((summary.workedMinutes / 360) * 100);
  const weekProgress = clampPercent(
    tracker.weekExpectedMinutes > 0
      ? (tracker.weekWorkedMinutes / tracker.weekExpectedMinutes) * 100
      : 0,
  );
  const breakProgress = clampPercent((summary.breakMinutes / 60) * 100);
  const bankProgress = tracker.hasHourBankMovements
    ? clampPercent((Math.abs(tracker.hourBankBalance) / 360) * 100)
    : 0;
  const weekBalanceLabel =
    tracker.weekReferenceDelta < 0
      ? `faltam ${minutesToHoursLabel(Math.abs(tracker.weekReferenceDelta))}`
      : tracker.weekReferenceDelta > 0
        ? `${minutesToHoursLabel(tracker.weekReferenceDelta)} extras`
        : "meta atingida";
  const progressMetrics = [
    {
      color: "#ffe45c",
      label: "Jornada",
      meta: `${todayProgress}% · ${selectedWorkedLabel}`,
      percent: todayProgress,
    },
    {
      color: "#78c9f2",
      label: "Semana",
      meta: `${weekProgress}% · ${minutesToHoursLabel(tracker.weekWorkedMinutes)} · ${weekBalanceLabel}`,
      percent: weekProgress,
    },
    {
      color: "#e579ef",
      label: "Banco",
      meta: `${bankProgress}% · ${bankLabel}`,
      percent: bankProgress,
    },
  ];
  const taskCards = [
    {
      accent: "#ffe45c",
      bg: "#fff9d7",
      icon: <AccessTimeRoundedIcon fontSize="small" />,
      label: tracker.state === "loading" ? "Salvando..." : buttonLabel,
      meta: `${minutesToClockDisplay(summary.workedMinutes)} horas hoje`,
      onClick: primaryActionClosesDay ? onOpenDirectClose : onOpenEntry,
      percent: todayProgress,
      disabled: !isPrimaryActionAvailable || tracker.state === "loading",
    },
    {
      accent: "#e579ef",
      bg: "#fdefff",
      icon: <CoffeeRoundedIcon fontSize="small" />,
      label: "Registrar pausa",
      meta: selectedBreakLabel,
      onClick: onOpenBreak,
      percent: breakProgress,
      disabled: tracker.state === "loading",
    },
    ...(showDirectClose
      ? [
          {
            accent: "#78c9f2",
            bg: "#eaf8ff",
            icon: <StopCircleRoundedIcon fontSize="small" />,
            label: "Encerrar expediente",
            meta: selectedRangeLabel,
            onClick: onOpenDirectClose,
            percent: Math.max(todayProgress, 1),
            disabled: tracker.state === "loading",
          },
        ]
      : []),
  ];

  function toggleSelectedDate(date: string) {
    setSelectedDateOverride((currentDate) => (currentDate === date ? null : date));
  }

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="visible">
      <Stack spacing={2.05} sx={{ pb: 1 }}>
        <Box
          component={motion.div}
          variants={fadeUp}
          sx={{
            bgcolor: "#ffffff",
            border: "1px solid #dadce0",
            borderRadius: "22px",
            boxShadow: "0 1px 2px rgba(60, 64, 67, 0.08)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1.25fr) minmax(150px, 0.75fr)" },
            }}
          >
            <Box sx={{ px: { xs: 1.35, sm: 1.55 }, py: { xs: 1.45, sm: 1.65 } }}>
              <Box sx={{ maxWidth: 330 }}>
                <Typography
                  sx={{
                    color: "#111827",
                    fontSize: { xs: "1.78rem", sm: "2.05rem" },
                    fontWeight: 900,
                    letterSpacing: 0,
                    lineHeight: 1.04,
                  }}
                >
                  Olá, {firstName}.
                </Typography>
                <Typography
                  sx={{
                    color: "#111827",
                    fontSize: { xs: "1.78rem", sm: "2.05rem" },
                    fontWeight: 900,
                    letterSpacing: 0,
                    lineHeight: 1.04,
                    mt: 0.15,
                  }}
                >
                  {greeting}!
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: "linear-gradient(90deg, #ffe45c 0%, #78c9f2 55%, #e579ef 100%)",
                  borderRadius: "999px",
                  height: 4,
                  mt: 1.45,
                  width: 86,
                }}
              />
            </Box>
            <Box
              sx={{
                bgcolor: "#050505",
                background:
                  "radial-gradient(circle at 88% 10%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 34%), #050505",
                borderLeft: { xs: 0, sm: "1px solid #111827" },
                borderTop: { xs: "1px solid #111827", sm: 0 },
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                px: { xs: 1.35, sm: 1.45 },
                py: { xs: 1.15, sm: 1.35 },
                textAlign: "center",
              }}
            >
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: "center", justifyContent: "center", mb: 0.8 }}
              >
                <Box
                  sx={{
                    alignItems: "center",
                    bgcolor: isBankPositive
                      ? "rgba(16, 185, 129, 0.16)"
                      : "rgba(239, 68, 68, 0.16)",
                    border: isBankPositive
                      ? "1px solid rgba(16, 185, 129, 0.34)"
                      : "1px solid rgba(239, 68, 68, 0.34)",
                    borderRadius: "50%",
                    color: isBankPositive ? "#6ee7b7" : "#fca5a5",
                    display: "flex",
                    height: 28,
                    justifyContent: "center",
                    width: 28,
                  }}
                >
                  {isBankPositive ? (
                    <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <TrendingDownRoundedIcon sx={{ fontSize: 18 }} />
                  )}
                </Box>
                <Typography sx={{ color: "rgba(255,255,255,0.68)", fontSize: "0.72rem", fontWeight: 850 }}>
                  Banco de horas
                </Typography>
              </Stack>
              <Typography
                sx={{
                  color: "#ffffff",
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: { xs: "1.45rem", sm: "1.58rem" },
                  fontWeight: 920,
                  lineHeight: 1,
                }}
              >
                {bankLabel}
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.58)", fontSize: "0.72rem", fontWeight: 760, mt: 0.65 }}>
                {tracker.hasHourBankMovements
                  ? isBankPositive
                    ? "Saldo positivo acumulado"
                    : "Saldo em débito acumulado"
                  : "Sem movimentos no banco"}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.7 }}>
          {weekStrip.map((item, index) => {
            void index;
            const isSelected = item.date === selectedDate;
            const isToday = item.date === summary.date;
            const isPast = item.date < summary.date;
            const daySummary = item.summary;
            const hasMedicalLeave = daySummary?.mark?.type === "medical_leave";
            const hasHoliday = daySummary?.mark?.type === "holiday";
            const showBalanceIcon =
              Boolean(daySummary) &&
              isPast &&
              !hasMedicalLeave &&
              !hasHoliday &&
              (daySummary!.balanceMinutes !== 0 || isCompletedWithoutDailyTarget(daySummary!));
            const balanceIsPositive =
              Boolean(daySummary) &&
              (daySummary!.balanceMinutes > 0 || isCompletedWithoutDailyTarget(daySummary!));

            return (
              <Box
                component={motion.button}
                key={item.date}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                aria-expanded={selectedDateOverride === item.date}
                onClick={() => toggleSelectedDate(item.date)}
                sx={{
                  appearance: "none",
                  bgcolor: "transparent",
                  border: 0,
                  color: "#111827",
                  cursor: "pointer",
                  font: "inherit",
                  p: 0,
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    alignItems: "center",
                    bgcolor: isToday ? "#050505" : "#ffffff",
                    border: isToday
                      ? "1px solid #050505"
                      : isSelected
                        ? "1px solid #111827"
                        : "1px solid #dadce0",
                    borderRadius: "14px",
                    boxShadow: isToday ? "0 10px 20px rgba(0,0,0,0.16)" : "none",
                    color: isToday ? "#ffffff" : "#111827",
                    display: "flex",
                    flexDirection: "column",
                    height: 76,
                    justifyContent: "center",
                    mx: "auto",
                    width: "100%",
                  }}
                >
                  <Typography
                    sx={{
                      color: isToday ? "rgba(255,255,255,0.72)" : "#7b808b",
                      fontSize: "0.62rem",
                      fontWeight: 850,
                      lineHeight: 1,
                    }}
                  >
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontSize: "1.18rem", fontWeight: 900, lineHeight: 1.05, mt: 0.4 }}>
                    {String(item.day).padStart(2, "0")}
                  </Typography>
                  <Box sx={{ height: 16, mt: 0.3, display: "grid", placeItems: "center" }}>
                    {showBalanceIcon && (
                      balanceIsPositive ? (
                        <TrendingUpRoundedIcon sx={{ color: "#10b981", fontSize: 17 }} />
                      ) : (
                        <TrendingDownRoundedIcon sx={{ color: "#ef4444", fontSize: 17 }} />
                      )
                    )}
                    {hasMedicalLeave && (
                      <Box sx={{ bgcolor: "#ef4444", borderRadius: "50%", height: 6, width: 6 }} />
                    )}
                    {hasHoliday && (
                      <Box sx={{ bgcolor: "#facc15", borderRadius: "50%", height: 6, width: 6 }} />
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>

        <AnimatePresence initial={false}>
          {selectedDateOverride && (
            <MotionCard
              key={selectedDate}
              variants={fadeUp}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              sx={{
                bgcolor: "#ffffff",
                borderColor: "#dadce0",
                borderRadius: "16px",
                boxShadow: "0 1px 2px rgba(60, 64, 67, 0.08)",
              }}
            >
              <CardContent sx={{ p: 1.2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900, lineHeight: 1.15 }}>
                        {formatWeekdayLongPtBr(selectedDay.date)}
                      </Typography>
                      <Typography color="text.secondary" sx={{ fontSize: "0.76rem", fontWeight: 720 }}>
                        {formatDateFullPtBr(selectedDay.date)}
                      </Typography>
                    </Box>
                    <Chip
                      label={selectedDay.mark?.type === "medical_leave"
                        ? "Atestado"
                        : selectedDay.mark?.type === "holiday"
                          ? "Feriado"
                          : statusLabels[selectedDay.status]}
                      size="small"
                      sx={{
                        bgcolor: "#f8fafd",
                        border: "1px solid #e8eaed",
                        borderRadius: "999px",
                        fontWeight: 850,
                      }}
                    />
                  </Stack>
                  <Divider sx={{ borderColor: "#e8eaed" }} />
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0.75 }}>
                    {[
                      ["Horário", selectedTimelineMoments.length > 0 ? selectedRangeLabel : "Sem ponto"],
                      ["Jornada", selectedWorkedLabel],
                      ["Saldo", minutesToHoursLabel(selectedDay.balanceMinutes)],
                    ].map(([label, value]) => (
                      <Box key={label} sx={{ minWidth: 0 }}>
                        <Typography color="text.secondary" sx={{ fontSize: "0.68rem", fontWeight: 780 }} noWrap>
                          {label}
                        </Typography>
                        <Typography sx={{ fontSize: "0.82rem", fontWeight: 900, mt: 0.15 }} noWrap>
                          {value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Stack>
              </CardContent>
            </MotionCard>
          )}
        </AnimatePresence>

        <MotionCard
          variants={fadeUp}
          sx={{
            bgcolor: "rgba(255,255,255,0.72)",
            borderColor: "#e3e5ec",
            borderRadius: "22px",
            boxShadow: "0 18px 36px rgba(28, 37, 65, 0.06)",
            overflow: "hidden",
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                bgcolor: "rgba(255,255,255,0.62)",
                borderBottom: "1px solid #e8ebf1",
                justifyContent: "space-between",
                px: { xs: 1.35, sm: 1.55 },
                py: 1.05,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "1rem", fontWeight: 900, lineHeight: 1.12 }}>
                  Hoje
                </Typography>
                <Typography sx={{ color: "#707682", fontSize: "0.73rem", fontWeight: 760, mt: 0.15 }}>
                  {formatWeekdayShortPtBr(summary.date)} · {formatDatePtBr(summary.date)}
                </Typography>
              </Box>
              <Chip
                icon={<AccessTimeRoundedIcon />}
                label={statusChipLabel}
                sx={{
                  bgcolor: "#ffffff",
                  border: "1px solid #e2e7ef",
                  borderRadius: "999px",
                  color: "#657083",
                  flexShrink: 0,
                  fontWeight: 850,
                  height: 30,
                  "& .MuiChip-icon": { color: "#78c9f2", fontSize: 18 },
                }}
              />
            </Stack>

            <Stack spacing={1.05} sx={{ px: { xs: 1.35, sm: 1.55 }, py: 1.25 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  alignItems: "stretch",
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    bgcolor: "#ffffff",
                    border: "1px solid #e7eaf1",
                    borderRadius: "16px",
                    flex: 1,
                    overflow: "hidden",
                    p: 1.05,
                  }}
                >
                  <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Box>
                      <Typography sx={{ color: "#707682", fontSize: "0.72rem", fontWeight: 780 }}>
                        Total de hoje
                      </Typography>
                      <Typography sx={{ fontSize: "1.06rem", fontWeight: 900, lineHeight: 1.15, mt: 0.25 }}>
                        {statusLabels[summary.status]}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        color: "#111827",
                        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                        fontSize: { xs: "1.95rem", sm: "2.12rem" },
                        fontWeight: 900,
                        letterSpacing: 0,
                        lineHeight: 1,
                      }}
                    >
                      {minutesToClockDisplay(summary.workedMinutes)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mt: 1 }}>
                    <Typography sx={{ color: "#707682", fontSize: "0.76rem", fontWeight: 820 }}>
                      Jornada do dia
                    </Typography>
                    <Typography sx={{ color: "#10a36d", fontSize: "0.76rem", fontWeight: 900 }}>
                      {todayProgress}%
                    </Typography>
                  </Stack>
                  <Box sx={{ bgcolor: "#e4e8ef", borderRadius: "999px", height: 6, mt: 0.55, overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${todayProgress}%` }}
                      transition={{ duration: motionDuration.slow, ease: motionEasing.emphasized }}
                      style={{
                        background: "linear-gradient(90deg, #ffe45c 0%, #78c9f2 52%, #10a36d 100%)",
                        borderRadius: 999,
                        height: "100%",
                      }}
                    />
                  </Box>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gap: 0.65,
                    gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", sm: "1fr" },
                    minWidth: { sm: 128 },
                  }}
                >
                  {[
                    ["Jornada", selectedWorkedLabel, "#ffe45c"],
                    ["Pausas", minutesToHoursLabel(summary.breakMinutes), "#e579ef"],
                    ["Banco", bankLabel, "#78c9f2"],
                  ].map(([label, value, color]) => (
                    <Box
                      key={label}
                      sx={{
                        bgcolor: "#ffffff",
                        border: "1px solid #e7eaf1",
                        borderRadius: "13px",
                        minWidth: 0,
                        px: 0.85,
                        py: 0.65,
                      }}
                    >
                      <Stack direction="row" spacing={0.45} sx={{ alignItems: "center", minWidth: 0 }}>
                        <Box sx={{ bgcolor: color, borderRadius: "999px", height: 16, width: 3, flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ color: "#707682", fontSize: "0.68rem", fontWeight: 780, lineHeight: 1.1 }} noWrap>
                            {label}
                          </Typography>
                          <Typography sx={{ fontSize: "0.86rem", fontWeight: 900, lineHeight: 1.25, mt: 0.15 }} noWrap>
                            {value}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Stack>

              <Typography sx={{ color: "#707682", fontSize: "0.78rem", fontWeight: 720, lineHeight: 1.3 }}>
                {tracker.hasTodayEntries
                  ? `${selectedRangeLabel} · ${selectedBreakLabel}`
                  : "Nenhum ponto registrado hoje ainda."}
              </Typography>
            </Stack>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={0.8}
              sx={{
                bgcolor: "rgba(245,247,251,0.78)",
                borderTop: "1px solid #e8ebf1",
                px: { xs: 1.35, sm: 1.55 },
                py: 1.05,
              }}
            >
                {isPrimaryActionAvailable ? (
                  <Button
                    fullWidth
                    disabled={tracker.state === "loading"}
                    onClick={primaryActionClosesDay ? onOpenDirectClose : onOpenEntry}
                    startIcon={primaryActionClosesDay ? <StopCircleRoundedIcon /> : <PlayArrowRoundedIcon />}
                    sx={{
                      bgcolor: primaryActionTone.bgcolor,
                      border: `1px solid ${primaryActionTone.border}`,
                      borderRadius: "12px",
                      boxShadow: primaryActionTone.boxShadow,
                      color: primaryActionTone.color,
                      fontWeight: 900,
                      minHeight: 42,
                      "&:hover": {
                        bgcolor: primaryActionTone.hoverBg,
                        boxShadow: primaryActionTone.hoverShadow,
                      },
                      "& .MuiButton-startIcon": {
                        color: primaryActionTone.iconColor,
                      },
                    }}
                    variant="contained"
                  >
                    {tracker.state === "loading" ? "Salvando..." : primaryButtonLabel}
                  </Button>
                ) : (
                  <Chip
                    icon={<CheckCircleRoundedIcon />}
                    label="Dia registrado"
                    sx={{
                      bgcolor: "#0f766e",
                      borderRadius: "12px",
                      color: "#ffffff",
                      flex: 1,
                      fontWeight: 900,
                      height: 42,
                      "& .MuiChip-icon": { color: "#ffffff" },
                    }}
                  />
                )}
                <Button
                  disabled={tracker.state === "loading"}
                  onClick={onOpenBreak}
                  startIcon={<CoffeeRoundedIcon />}
                  sx={{
                    bgcolor: "#ffffff",
                    borderColor: "#dadce0",
                    borderRadius: "12px",
                    color: "#111827",
                    fontWeight: 900,
                    minHeight: 42,
                    minWidth: { sm: 118 },
                    "&:hover": {
                      borderColor: "#c7cdd8",
                      bgcolor: "#f8fafd",
                    },
                    "& .MuiButton-startIcon": {
                      color: "#0284c7",
                    },
                  }}
                  variant="outlined"
                >
                  Pausa
                </Button>
                {showDirectClose && !primaryActionClosesDay && (
                  <Button
                    disabled={tracker.state === "loading"}
                    onClick={onOpenDirectClose}
                    startIcon={<StopCircleRoundedIcon />}
                    sx={{
                      bgcolor: "#ef4444",
                      borderRadius: "12px",
                      boxShadow: "none",
                      color: "#ffffff",
                      fontWeight: 900,
                      minHeight: 42,
                      minWidth: { sm: 118 },
                      "&:hover": {
                        bgcolor: "#dc2626",
                        boxShadow: "none",
                      },
                      "& .MuiButton-startIcon": {
                        color: "#ffffff",
                      },
                    }}
                    variant="contained"
                  >
                    Encerrar
                  </Button>
                )}
            </Stack>
          </CardContent>
        </MotionCard>

        <MotionCard
          variants={fadeUp}
          sx={{
            bgcolor: "rgba(255,255,255,0.72)",
            borderColor: "#e3e5ec",
            borderRadius: "22px",
            boxShadow: "0 18px 36px rgba(28, 37, 65, 0.06)",
          }}
        >
          <CardContent sx={{ p: { xs: 1.45, sm: 1.7 } }}>
            <Stack spacing={1.2}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: "1.12rem", fontWeight: 900 }}>
                  Progresso
                </Typography>
                <Chip
                  deleteIcon={<ExpandMoreRoundedIcon />}
                  label="Semanal"
                  onDelete={() => undefined}
                  sx={{
                    bgcolor: "#ffffff",
                    border: "1px solid #eceef4",
                    borderRadius: "999px",
                    fontWeight: 800,
                    height: 28,
                    pr: 0.2,
                    "& .MuiChip-deleteIcon": {
                      bgcolor: "#e579ef",
                      borderRadius: "50%",
                      color: "#ffffff",
                      fontSize: 18,
                      mr: 0.2,
                    },
                  }}
                />
              </Stack>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  alignItems: { xs: "stretch", sm: "center" },
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Stack spacing={1.05} sx={{ minWidth: 0 }}>
                  {progressMetrics.map((metric) => (
                    <Stack direction="row" key={metric.label} spacing={0.8} sx={{ alignItems: "center" }}>
                      <Box
                        sx={{
                          bgcolor: metric.color,
                          borderRadius: "999px",
                          height: 26,
                          width: 3,
                        }}
                      />
                      <Box>
                        <Typography sx={{ color: "#6f7480", fontSize: "0.73rem", fontWeight: 760, lineHeight: 1.1 }}>
                          {metric.label}
                        </Typography>
                        <Typography sx={{ fontSize: "0.82rem", fontWeight: 900, lineHeight: 1.2 }}>
                          {metric.meta}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
                <ActivityProgressLineChart days={weekStrip} todayKey={summary.date} />
              </Stack>
              <Divider />
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ color: "#707682", fontSize: "0.78rem", fontWeight: 760 }}>
                  {activeDays} dias ativos
                </Typography>
                <Typography sx={{ color: "#707682", fontSize: "0.78rem", fontWeight: 760 }}>
                  {completedDays} concluídos
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </MotionCard>

        {tracker.error && <Alert severity="error">{tracker.error}</Alert>}

        <Stack spacing={1.2}>
          <Typography sx={{ fontSize: "1.45rem", fontWeight: 900, letterSpacing: 0 }}>
            Atividades
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ overflowX: "auto", pb: 0.2 }}>
            {["Tudo", "Jornada", "Pausas", "Banco"].map((label, index) => (
              <Chip
                key={label}
                label={label}
                sx={{
                  bgcolor: index === 1 ? "#ffe96b" : "#ffffff",
                  border: "1px solid #e6e8ef",
                  borderRadius: "999px",
                  color: "#111827",
                  flexShrink: 0,
                  fontWeight: 800,
                  height: 36,
                  px: 0.6,
                }}
              />
            ))}
          </Stack>

          <Stack spacing={1}>
            {taskCards.map((task) => (
              <Box
                component={motion.button}
                disabled={task.disabled}
                key={task.label}
                onClick={task.onClick}
                type="button"
                whileHover={task.disabled ? undefined : { y: -2 }}
                whileTap={task.disabled ? undefined : { scale: 0.985 }}
                sx={{
                  alignItems: "center",
                  bgcolor: "#ffffff",
                  border: "1px solid #e8eaf1",
                  borderRadius: "18px",
                  boxShadow: "0 12px 24px rgba(28, 37, 65, 0.055)",
                  color: "#111827",
                  cursor: task.disabled ? "default" : "pointer",
                  display: "grid",
                  font: "inherit",
                  gap: 1,
                  gridTemplateColumns: "44px minmax(0, 1fr) 42px 18px",
                  minHeight: 72,
                  opacity: task.disabled ? 0.72 : 1,
                  p: 1,
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <Box
                  sx={{
                    alignItems: "center",
                    bgcolor: task.bg,
                    border: `2px solid ${task.accent}`,
                    borderRadius: "50%",
                    color: "#111827",
                    display: "flex",
                    height: 42,
                    justifyContent: "center",
                    width: 42,
                  }}
                >
                  {task.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 900, lineHeight: 1.15 }} noWrap>
                    {task.label}
                  </Typography>
                  <Typography sx={{ color: "#6f7480", fontSize: "0.73rem", fontWeight: 650, mt: 0.35 }} noWrap>
                    {task.meta}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 900, justifySelf: "end" }}>
                  {task.percent}%
                </Typography>
                <ChevronRightRoundedIcon sx={{ color: "#111827", fontSize: 20 }} />
              </Box>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </motion.section>
  );
}

function SummaryGrid({ items }: { items: [string, string, string][] }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.1 }}>
      {items.map(([title, value, caption]) => (
        <MotionCard key={title} variants={fadeUp}>
          <CardContent sx={{ p: 1.2, bgcolor: "#ffffff" }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography sx={{ fontWeight: 900, lineHeight: 1.15, mt: 0.15 }}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {caption}
            </Typography>
          </CardContent>
        </MotionCard>
      ))}
    </Box>
  );
}

type CalendarDayItem = ReturnType<typeof useTimeTracker>["calendarDays"][number];

const calendarWeekdayLabels = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

function getCalendarLeadingSlots(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const weekDay = firstDay.getDay();

  return weekDay === 0 ? 6 : weekDay - 1;
}

function hasCalendarDayActivity(day: CalendarDayItem) {
  return day.entries.length > 0 || day.breaks.length > 0 || Boolean(day.mark);
}

function getCalendarCellTone(day: CalendarDayItem, todayKey?: string) {
  if (day.mark?.type === "medical_leave") {
    return { label: "Atestado", bg: "#fff1f2", border: "#fecdd3", accent: "#be123c", chip: "#ffe4e6" };
  }

  if (day.mark?.type === "holiday") {
    return { label: "Feriado", bg: "#f5f3ff", border: "#c4b5fd", accent: "#6d28d9", chip: "#ede9fe" };
  }

  if (day.mark?.type === "excluded") {
    return { label: "Limpo", bg: "#f8fafc", border: "#cbd5e1", accent: "#475569", chip: "#f1f5f9" };
  }

  if (isCompletedWithoutDailyTarget(day)) {
    return { label: "Concluído", bg: "#ffffff", border: "#eee9df", accent: "#047857", chip: "#dcfce7" };
  }

  if (!hasCalendarDayActivity(day)) {
    if (day.status === "today") {
      return { label: "Hoje", bg: "#fff7ed", border: "#fed7aa", accent: "#f57c00", chip: "#ffedd5" };
    }

    if (todayKey && day.date > todayKey) {
      return { label: "", bg: "#ffffff", border: "#eee9df", accent: "#94a3b8", chip: "#ffffff" };
    }

    return { label: "", bg: "#f7f6f3", border: "#efebe4", accent: "#64748b", chip: "#ffffff" };
  }

  if (day.status === "pending") {
    return { label: "Pendente", bg: "#fffbeb", border: "#fde68a", accent: "#b45309", chip: "#fef3c7" };
  }

  if (day.balanceMinutes < 0) {
    return { label: "Negativo", bg: "#ffffff", border: "#eee9df", accent: "#dc2626", chip: "#ffe4e6" };
  }

  if (day.balanceMinutes > 0) {
    return { label: "Crédito", bg: "#ffffff", border: "#eee9df", accent: "#047857", chip: "#dcfce7" };
  }

  if (day.status === "today") {
    return { label: "Hoje", bg: "#fff7ed", border: "#fed7aa", accent: "#f57c00", chip: "#ffedd5" };
  }

  return { label: day.entries.length > 0 || day.breaks.length > 0 ? "Ok" : "", bg: "#f7f6f3", border: "#efebe4", accent: "#64748b", chip: "#ffffff" };
}

function getCalendarBalanceIndicator(day: CalendarDayItem) {
  const hasBlockingMark = day.mark && day.mark.type !== "completed";

  if (!hasCalendarDayActivity(day) || hasBlockingMark || day.status === "pending") {
    return null;
  }

  if (day.balanceMinutes > 0) {
    return {
      direction: "up" as const,
      label: `+${minutesToHoursLabel(day.balanceMinutes)}`,
      accent: "#10b981",
      bg: "#ecfdf5",
      border: "#a7f3d0",
    };
  }

  if (day.balanceMinutes < 0) {
    return {
      direction: "down" as const,
      label: minutesToHoursLabel(day.balanceMinutes),
      accent: "#ef4444",
      bg: "#fff1f2",
      border: "#fecdd3",
    };
  }

  return null;
}

function shouldShowCalendarSidebarDay(day: CalendarDayItem) {
  if (!hasCalendarDayActivity(day)) {
    return false;
  }

  return (
    day.mark?.type === "holiday" ||
    day.mark?.type === "medical_leave" ||
    day.mark?.type === "excluded" ||
    isCompletedWithoutDailyTarget(day) ||
    day.status === "pending" ||
    day.balanceMinutes < 0 ||
    day.balanceMinutes > 0
  );
}

function CalendarView({
  tracker,
  onAddBreak,
  onAddTime,
  onEdit,
  onOpenDirectClose,
  onCompleteDay,
  onToggleHoliday,
  onToggleExcludedDay,
  onToggleMedicalLeave,
}: {
  tracker: ReturnType<typeof useTimeTracker>;
  onAddBreak: (date: string) => void;
  onAddTime: (date: string) => void;
  onEdit: (target: EditTarget) => void;
  onOpenDirectClose: (date: string) => void;
  onCompleteDay: (date: string) => Promise<void>;
  onToggleHoliday: (date: string) => Promise<void>;
  onToggleExcludedDay: (date: string) => Promise<void>;
  onToggleMedicalLeave: (date: string) => Promise<void>;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedDay =
    tracker.calendarDays.find((day) => day.date === selectedDate) ?? null;
  const popoverOpen = Boolean(anchorEl && selectedDay);
  const isCurrentMonth =
    tracker.calendarMonth.getFullYear() === tracker.today.getFullYear() &&
    tracker.calendarMonth.getMonth() === tracker.today.getMonth();
  const leadingSlots = getCalendarLeadingSlots(tracker.calendarMonth);
  const calendarCells = [
    ...Array.from<null>({ length: leadingSlots }).fill(null),
    ...tracker.calendarDays,
  ];
  const trailingSlots = (7 - (calendarCells.length % 7)) % 7;
  const paddedCalendarCells = [
    ...calendarCells,
    ...Array.from<null>({ length: trailingSlots }).fill(null),
  ];
  const sidebarDays = tracker.calendarDays.filter(shouldShowCalendarSidebarDay);

  function openDay(event: MouseEvent<HTMLElement>, date: string) {
    setAnchorEl(event.currentTarget);
    setSelectedDate(date);
  }

  function closeDay() {
    setAnchorEl(null);
    setSelectedDate(null);
  }

  function navigateCalendar(monthDelta: number) {
    closeDay();
    tracker.moveCalendarMonth(monthDelta);
  }

  function resetCalendar() {
    closeDay();
    tracker.resetCalendarMonth();
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <SectionTitle title="Calendário" subtitle={formatMonthPtBr(tracker.calendarMonth)} />
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: { xs: "space-between", sm: "flex-end" },
            gap: 0.75,
          }}
        >
          <CalendarNavButton
            label="Ano anterior"
            onClick={() => navigateCalendar(-12)}
            icon={<KeyboardDoubleArrowLeftRoundedIcon fontSize="small" />}
          />
          <CalendarNavButton
            label="Mês anterior"
            onClick={() => navigateCalendar(-1)}
            icon={<ChevronLeftRoundedIcon fontSize="small" />}
          />
          <Tooltip title="Voltar para o mês atual">
            <span>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                disabled={isCurrentMonth}
                startIcon={<TodayRoundedIcon />}
                onClick={resetCalendar}
                sx={{
                  borderRadius: "8px",
                  minWidth: 0,
                  px: 1.4,
                  whiteSpace: "nowrap",
                }}
              >
                Hoje
              </Button>
            </span>
          </Tooltip>
          <CalendarNavButton
            label="Próximo mês"
            onClick={() => navigateCalendar(1)}
            icon={<ChevronRightRoundedIcon fontSize="small" />}
          />
          <CalendarNavButton
            label="Próximo ano"
            onClick={() => navigateCalendar(12)}
            icon={<KeyboardDoubleArrowRightRoundedIcon fontSize="small" />}
          />
        </Stack>
      </Stack>
      <Card sx={{ borderRadius: "10px", overflow: "hidden" }}>
        <CardContent sx={{ p: { xs: 1, md: 1.5 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 280px" },
              gap: { xs: 1.5, md: 1.75 },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 0.55,
                  mb: 0.65,
                }}
              >
                {calendarWeekdayLabels.map((label) => (
                  <Box
                    key={label}
                    sx={{
                      borderRadius: "8px",
                      bgcolor: "#f4f2ee",
                      py: 0.75,
                      textAlign: "center",
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 900, color: "#44403c" }}>
                      {label}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 0.55,
                }}
              >
                {paddedCalendarCells.map((day, index) => {
                  if (!day) {
                    return (
                      <Box
                        key={`empty-${index}`}
                        sx={{
                          minHeight: { xs: 62, md: 92 },
                          borderRadius: "8px",
                          bgcolor: "rgba(244, 242, 238, 0.38)",
                        }}
                      />
                    );
                  }

                  const tone = getCalendarCellTone(day, tracker.todayKey);
                  const balanceIndicator = getCalendarBalanceIndicator(day);
                  const hasSummary =
                    day.entries.length > 0 ||
                    day.breaks.length > 0 ||
                    Boolean(day.mark);

                  return (
                    <Tooltip
                      arrow
                      disableHoverListener={!hasSummary}
                      key={day.date}
                      title={<CalendarDayTooltip day={day} />}
                    >
                      <Box
                        component={motion.button}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ delay: index * 0.006 }}
                        onClick={(event) => openDay(event, day.date)}
                        sx={{
                          minHeight: { xs: 62, md: 92 },
                          borderRadius: "8px",
                          border: `1px solid ${tone.border}`,
                          bgcolor: tone.bg,
                          color: "text.primary",
                          cursor: "pointer",
                          font: "inherit",
                          p: { xs: 0.55, md: 0.8 },
                          textAlign: "left",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          boxShadow: hasSummary
                            ? "0 8px 20px rgba(64, 42, 12, 0.07)"
                            : "none",
                          "&:hover": {
                            boxShadow: "0 12px 28px rgba(64, 42, 12, 0.12)",
                          },
                        }}
                      >
                        <Stack
                          direction="row"
                          sx={{ alignItems: "center", justifyContent: "space-between", gap: 0.5 }}
                        >
                          <Typography sx={{ fontWeight: 900, fontSize: "0.8rem" }}>
                            {day.day}
                          </Typography>
                          {(tone.label || balanceIndicator) && (
                            <Box
                              sx={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                bgcolor: balanceIndicator?.accent ?? tone.accent,
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </Stack>
                        {hasSummary && (
                          <Box sx={{ minWidth: 0 }}>
                            {balanceIndicator ? (
                              <Stack
                                direction="row"
                                sx={{
                                  alignItems: "center",
                                  bgcolor: balanceIndicator.bg,
                                  border: `1px solid ${balanceIndicator.border}`,
                                  borderRadius: "999px",
                                  color: balanceIndicator.accent,
                                  display: "inline-flex",
                                  gap: 0.35,
                                  maxWidth: "100%",
                                  px: 0.65,
                                  py: 0.2,
                                }}
                              >
                                {balanceIndicator.direction === "up" ? (
                                  <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />
                                ) : (
                                  <TrendingDownRoundedIcon sx={{ fontSize: 16 }} />
                                )}
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "inherit",
                                    fontWeight: 900,
                                    lineHeight: 1.1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {balanceIndicator.label}
                                </Typography>
                              </Stack>
                            ) : (
                              tone.label && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: tone.accent,
                                    display: "block",
                                    fontWeight: 900,
                                    lineHeight: 1.1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {tone.label}
                                </Typography>
                              )
                            )}
                          </Box>
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
            <CalendarSidebar
              key={`${tracker.calendarMonth.getFullYear()}-${tracker.calendarMonth.getMonth()}`}
              days={sidebarDays}
              month={tracker.calendarMonth}
              onOpenDay={(event, date) => openDay(event, date)}
            />
          </Box>
        </CardContent>
      </Card>
      <Popover
        open={popoverOpen}
        anchorEl={anchorEl}
        onClose={closeDay}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              width: 392,
              maxWidth: "calc(100vw - 32px)",
              borderRadius: "12px",
              border: `1px solid rgba(36, 50, 40, 0.1)`,
              boxShadow: "0 20px 52px rgba(36, 50, 40, 0.22)",
              overflow: "hidden",
            },
          },
        }}
      >
        {selectedDay && (
          <DayPopoverContent
            day={selectedDay}
            onAddBreak={onAddBreak}
            onAddTime={onAddTime}
            onEdit={onEdit}
            onAfterEdit={closeDay}
            onOpenDirectClose={onOpenDirectClose}
            onCompleteDay={onCompleteDay}
            onToggleHoliday={onToggleHoliday}
            onToggleExcludedDay={onToggleExcludedDay}
            onToggleMedicalLeave={onToggleMedicalLeave}
          />
        )}
      </Popover>
      <Legend />
    </Stack>
  );
}

function CalendarSidebar({
  days,
  month,
  onOpenDay,
}: {
  days: CalendarDayItem[];
  month: Date;
  onOpenDay: (event: MouseEvent<HTMLElement>, date: string) => void;
}) {
  const monthLabel = formatMonthPtBr(month);

  return (
    <Box
      sx={{
        borderRadius: "10px",
        bgcolor: "#f7f6f3",
        border: `1px solid ${nanaColors.line}`,
        p: 1.2,
        maxHeight: { md: 560 },
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      <Stack spacing={1.1} sx={{ minWidth: 0 }}>
        <Box sx={{ px: 0.25 }}>
          <Typography sx={{ fontWeight: 900 }}>Destaques do mês</Typography>
          <Typography variant="body2" color="text.secondary">
            {monthLabel} · feriados, saldos e pendências
          </Typography>
        </Box>
        {days.length === 0 ? (
          <Alert severity="success" sx={{ borderRadius: "8px" }}>
            Nenhum ponto de atenção em {monthLabel}.
          </Alert>
        ) : (
          days.map((day, index) => {
            const tone = getCalendarCellTone(day);
            const balanceIndicator = getCalendarBalanceIndicator(day);
            const canCloseDay = canCloseEntriesDirectly(day.entries);
            const headerBg =
              day.balanceMinutes !== 0 && !day.mark && day.status !== "pending"
                ? "#fafafa"
                : tone.chip;

            return (
              <Box
                component={motion.button}
                key={`calendar-sidebar-${day.date}`}
                type="button"
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.98 }}
                viewport={{ once: false, amount: 0.45 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.12) }}
                onClick={(event) => onOpenDay(event, day.date)}
                sx={{
                  border: `1px solid ${tone.border}`,
                  borderRadius: "10px",
                  bgcolor: "#ffffff",
                  boxShadow: "0 10px 24px rgba(64, 42, 12, 0.07)",
                  cursor: "pointer",
                  boxSizing: "border-box",
                  display: "block",
                  font: "inherit",
                  maxWidth: "100%",
                  overflow: "hidden",
                  p: 0,
                  textAlign: "left",
                  width: "100%",
                  "&:hover": {
                    boxShadow: "0 14px 30px rgba(64, 42, 12, 0.11)",
                  },
                }}
              >
                <Box
                  sx={{
                    bgcolor: headerBg,
                    borderBottom: `1px solid ${tone.border}`,
                    px: 1,
                    py: 0.85,
                  }}
                >
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
                  >
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: balanceIndicator?.accent ?? tone.accent,
                          flexShrink: 0,
                        }}
                      />
                      <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                        {formatDatePtBr(day.date)}
                      </Typography>
                    </Stack>
                    <Chip
                      label={tone.label}
                      size="small"
                      sx={{
                        borderRadius: "7px",
                        bgcolor: "#ffffff",
                        color: tone.accent,
                        flexShrink: 0,
                        fontWeight: 900,
                        boxShadow: `inset 0 0 0 1px ${tone.border}`,
                      }}
                    />
                  </Stack>
                </Box>
                <Box sx={{ px: 1, py: 0.95 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#4b5563",
                      fontWeight: 700,
                      lineHeight: 1.35,
                    }}
                  >
                    {day.mark?.note ?? statusLabels[day.dayStatus]}
                  </Typography>
                </Box>
                <Divider />
                <Stack
                  direction="row"
                  sx={{
                    alignItems: "center",
                    bgcolor: "#f8fafc",
                    gap: 0.75,
                    justifyContent: "space-between",
                    px: 1,
                    py: 0.85,
                  }}
                >
                  <Chip
                    label={`Jornada ${minutesToHoursLabel(day.workedMinutes)}`}
                    size="small"
                    sx={{
                      borderRadius: "7px",
                      bgcolor: "#ffffff",
                      color: "#475569",
                      fontWeight: 900,
                      maxWidth: "48%",
                    }}
                  />
                  <Stack
                    direction="row"
                    spacing={0.6}
                    sx={{
                      alignItems: "center",
                      flexShrink: 0,
                      justifyContent: "flex-end",
                      minWidth: 0,
                    }}
                  >
                    {balanceIndicator && (
                      <Box
                        sx={{
                          alignItems: "center",
                          bgcolor: balanceIndicator.bg,
                          border: `1px solid ${balanceIndicator.border}`,
                          borderRadius: "999px",
                          color: balanceIndicator.accent,
                          display: "inline-flex",
                          gap: 0.35,
                          px: 0.75,
                          py: 0.35,
                        }}
                      >
                        {balanceIndicator.direction === "up" ? (
                          <TrendingUpRoundedIcon sx={{ fontSize: 15 }} />
                        ) : (
                          <TrendingDownRoundedIcon sx={{ fontSize: 15 }} />
                        )}
                        <Typography
                          variant="caption"
                          sx={{ color: "inherit", fontWeight: 900, lineHeight: 1 }}
                        >
                          {balanceIndicator.label}
                        </Typography>
                      </Box>
                    )}
                    {!balanceIndicator && day.balanceMinutes !== 0 && (
                      <Chip
                        label={`Saldo ${minutesToHoursLabel(day.balanceMinutes)}`}
                        size="small"
                        sx={{
                          borderRadius: "6px",
                          bgcolor: day.balanceMinutes < 0 ? "#fff1f2" : "#ecfdf5",
                          color: day.balanceMinutes < 0 ? "#dc2626" : "#047857",
                          fontWeight: 900,
                        }}
                      />
                    )}
                    {canCloseDay && (
                      <Chip
                        label="Encerrar"
                        size="small"
                        sx={{ borderRadius: "6px", bgcolor: "#ffedd5", color: "#c2410c" }}
                      />
                    )}
                  </Stack>
                </Stack>
              </Box>
            );
          })
        )}
      </Stack>
    </Box>
  );
}

function CalendarDayTooltip({
  day,
}: {
  day: ReturnType<typeof useTimeTracker>["calendarDays"][number];
}) {
  const firstEntry = [...day.entries].sort((first, second) =>
    first.occurredAt.localeCompare(second.occurredAt),
  )[0];
  const lastEntry = [...day.entries].sort((first, second) =>
    second.occurredAt.localeCompare(first.occurredAt),
  )[0];

  return (
    <Box sx={{ maxWidth: 240, py: 0.3 }}>
      <Typography sx={{ fontWeight: 900, fontSize: "0.82rem" }}>
        {formatDateFullPtBr(day.date)}
      </Typography>
      {day.mark?.type === "holiday" && (
        <Typography sx={{ color: "#ddd6fe", fontWeight: 800, fontSize: "0.78rem" }}>
          Feriado: {day.mark.note ?? "marcado"}
        </Typography>
      )}
      {day.mark?.type === "excluded" && (
        <Typography sx={{ color: "#e2e8f0", fontWeight: 800, fontSize: "0.78rem" }}>
          Dia limpo: não entra na contabilização
        </Typography>
      )}
      {day.mark?.type === "medical_leave" && (
        <Typography sx={{ color: "#fecdd3", fontWeight: 800, fontSize: "0.78rem" }}>
          Atestado médico: ausência justificada
        </Typography>
      )}
      {(day.entries.length > 0 || day.breaks.length > 0) && (
        <Typography sx={{ fontSize: "0.78rem", mt: 0.35 }}>
          {minutesToHoursLabel(day.workedMinutes)} registrados
          {firstEntry ? ` · entrada ${formatTimePtBr(firstEntry.occurredAt)}` : ""}
          {lastEntry && lastEntry.id !== firstEntry?.id
            ? ` · último ${formatTimePtBr(lastEntry.occurredAt)}`
            : ""}
          {day.breaks.length > 0 ? ` · ${day.breaks.length} pausas` : ""}
        </Typography>
      )}
    </Box>
  );
}

function DayPopoverContent({
  day,
  onAddBreak,
  onAddTime,
  onEdit,
  onAfterEdit,
  onOpenDirectClose,
  onCompleteDay,
  onToggleHoliday,
  onToggleExcludedDay,
  onToggleMedicalLeave,
}: {
  day: ReturnType<typeof useTimeTracker>["calendarDays"][number];
  onAddBreak: (date: string) => void;
  onAddTime: (date: string) => void;
  onEdit: (target: EditTarget) => void;
  onAfterEdit: () => void;
  onOpenDirectClose: (date: string) => void;
  onCompleteDay: (date: string) => Promise<void>;
  onToggleHoliday: (date: string) => Promise<void>;
  onToggleExcludedDay: (date: string) => Promise<void>;
  onToggleMedicalLeave: (date: string) => Promise<void>;
}) {
  const hasRecords = day.entries.length > 0 || day.breaks.length > 0;
  const isHoliday = day.mark?.type === "holiday";
  const isExcluded = day.mark?.type === "excluded";
  const isMedicalLeave = day.mark?.type === "medical_leave";
  const isCompleted = isCompletedWithoutDailyTarget(day);
  const balanceLabel =
    isCompleted
      ? `${minutesToHoursLabel(day.workedMinutes)} trabalhadas`
    : day.balanceMinutes === 0
      ? "0min"
      : minutesToHoursLabel(day.balanceMinutes);
  const statusColor =
    isExcluded
      ? "#475569"
      : isMedicalLeave
        ? "#be123c"
      : isCompleted
        ? "#047857"
      : isHoliday
      ? "#7c3aed"
      : day.status === "empty"
      ? nanaColors.muted
      : day.status === "negative" || day.status === "pending"
        ? "#d97706"
        : "#2563eb";
  const recordCount = day.entries.length + day.breaks.length;
  const canCloseDay = canCloseEntriesDirectly(day.entries);
  const canCompleteWithoutDebit =
    hasRecords &&
    day.dayStatus === "closed" &&
    day.balanceMinutes < 0 &&
    !isHoliday &&
    !isExcluded &&
    !isMedicalLeave &&
    !isCompleted;
  const dayStatusLabel = isExcluded
    ? "Dia limpo"
    : isMedicalLeave
      ? "Atestado médico"
    : isCompleted
      ? "Dia concluído"
    : isHoliday
      ? "Feriado"
      : statusLabels[day.dayStatus];
  const workedLabel =
    isExcluded || isMedicalLeave ? "Ignorado" : minutesToHoursLabel(day.workedMinutes);
  const balanceCaption = isExcluded
    ? "Não contabiliza este dia"
    : isMedicalLeave
      ? "Ausência justificada"
    : isCompleted
      ? "Conta como saldo semanal"
    : day.balanceMinutes === 0
      ? "Sem saldo no dia"
      : `${balanceLabel} de saldo`;

  function edit(target: EditTarget) {
    onEdit(target);
    onAfterEdit();
  }

  function addTime() {
    onAddTime(day.date);
    onAfterEdit();
  }

  function addBreak() {
    onAddBreak(day.date);
    onAfterEdit();
  }

  function closeDayDirectly() {
    onOpenDirectClose(day.date);
    onAfterEdit();
  }

  function completeWithoutDebit() {
    void onCompleteDay(day.date).then(onAfterEdit);
  }

  function toggleHoliday() {
    void onToggleHoliday(day.date).then(onAfterEdit);
  }

  function toggleExcludedDay() {
    void onToggleExcludedDay(day.date).then(onAfterEdit);
  }

  function toggleMedicalLeave() {
    void onToggleMedicalLeave(day.date).then(onAfterEdit);
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22 }}
      sx={{
        bgcolor: "#ffffff",
        maxHeight: "min(620px, calc(100vh - 48px))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.75,
          borderBottom: `1px solid ${nanaColors.line}`,
        }}
      >
        <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
              Detalhes do dia
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {formatWeekdayLongPtBr(day.date)} · {formatDatePtBr(day.date)}
            </Typography>
            {isHoliday && (
              <Chip
                icon={<EventBusyRoundedIcon fontSize="small" />}
                label="Feriado"
                size="small"
                sx={{
                  mt: 1,
                  borderRadius: "6px",
                  bgcolor: "#f5f3ff",
                  color: "#6d28d9",
                  fontWeight: 900,
                }}
              />
            )}
            {isExcluded && (
              <Chip
                icon={<DeleteSweepRoundedIcon fontSize="small" />}
                label="Dia limpo"
                size="small"
                sx={{
                  mt: 1,
                  borderRadius: "6px",
                  bgcolor: "#f1f5f9",
                  color: "#475569",
                  fontWeight: 900,
                }}
              />
            )}
            {isMedicalLeave && (
              <Chip
                icon={<LocalHospitalRoundedIcon fontSize="small" />}
                label="Atestado médico"
                size="small"
                sx={{
                  mt: 1,
                  borderRadius: "6px",
                  bgcolor: "#fff1f2",
                  color: "#be123c",
                  fontWeight: 900,
                }}
              />
            )}
            {isCompleted && (
              <Chip
                icon={<AccessTimeRoundedIcon fontSize="small" />}
                label="Dia concluído"
                size="small"
                sx={{
                  mt: 1,
                  borderRadius: "6px",
                  bgcolor: "#ecfdf5",
                  color: "#047857",
                  fontWeight: 900,
                }}
              />
            )}
          </Box>
          <IconButton
            aria-label="Fechar detalhes do dia"
            onClick={onAfterEdit}
            size="small"
            sx={{
              border: `1px solid ${nanaColors.line}`,
              borderRadius: "8px",
              color: "text.secondary",
              "&:hover": { bgcolor: nanaColors.surfaceAlt },
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
          px: 2,
          py: 2,
          scrollbarColor: "#cbd5e1 transparent",
          "&::-webkit-scrollbar": { width: 8 },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "#cbd5e1",
            borderRadius: 999,
          },
          "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
        }}
      >
        <Stack spacing={1.6}>
          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2, boxShadow: "0 12px 28px rgba(37, 99, 235, 0.16)" }}
            transition={{ duration: 0.22 }}
            sx={{
              border: "2px solid #2563eb",
              borderRadius: "10px",
              p: 1.25,
              bgcolor: "#f8fbff",
              boxShadow: "0 8px 20px rgba(37, 99, 235, 0.08)",
            }}
          >
            <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 54,
              height: 54,
              borderRadius: "8px",
              display: "grid",
              placeItems: "center",
              bgcolor: "#dbeafe",
              color: "#2563eb",
              flexShrink: 0,
            }}
          >
            <Box sx={{ textAlign: "center", lineHeight: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 900 }}>
                {formatWeekdayShortPtBr(day.date)}
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: "1.35rem" }}>
                {day.day}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 800 }}
            >
              {dayStatusLabel}
            </Typography>
            <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", lineHeight: 1.2 }}>
              {workedLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {balanceCaption}
            </Typography>
          </Box>
          <Chip
            label={
              isExcluded
                ? "limpo"
                : isMedicalLeave
                  ? "atestado"
                : isHoliday
                  ? "feriado"
                  : hasRecords
                    ? `${recordCount} itens`
                    : "vazio"
            }
            size="small"
            sx={{
              borderRadius: "6px",
              bgcolor: isExcluded
                ? "#f1f5f9"
                : isMedicalLeave
                  ? "#fff1f2"
                : isHoliday
                  ? "#f5f3ff"
                  : hasRecords
                    ? "#eef2ff"
                    : "#f3f0ea",
              color: isExcluded
                ? "#475569"
                : isMedicalLeave
                  ? "#be123c"
                : isHoliday
                  ? "#6d28d9"
                  : hasRecords
                    ? "#4338ca"
                    : nanaColors.muted,
              fontWeight: 900,
            }}
          />
            </Stack>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 1,
            }}
          >
            <PopoverMetric
              color={statusColor}
              label="Status"
              surface={
                isExcluded ? "#f8fafc" : isMedicalLeave ? "#fff1f2" : "#f5f3ff"
              }
              value={dayStatusLabel}
            />
            <PopoverMetric
              color={isExcluded || isMedicalLeave ? "#475569" : "#0f766e"}
              label="Jornada"
              surface={isExcluded || isMedicalLeave ? "#f8fafc" : "#f0fdfa"}
              value={workedLabel}
            />
            <PopoverMetric
              color={isCompleted ? "#047857" : day.balanceMinutes < 0 ? "#d97706" : "#4f46e5"}
              label={isCompleted ? "Para as 30h" : "Saldo"}
              surface={isCompleted ? "#ecfdf5" : day.balanceMinutes < 0 ? "#fff7ed" : "#eef2ff"}
              value={balanceLabel}
            />
          </Box>

          {(canCloseDay || canCompleteWithoutDebit) && (
            <Box
              component={motion.div}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2, boxShadow: "0 14px 30px rgba(194, 65, 12, 0.16)" }}
              viewport={{ once: false, amount: 0.7 }}
              transition={{ duration: 0.2 }}
              sx={{
                borderRadius: "10px",
                border: "1px solid #fed7aa",
                bgcolor: "#fff7ed",
                p: 1.25,
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{ gap: 1.2, alignItems: { xs: "stretch", sm: "center" } }}
              >
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: "9px",
                    display: { xs: "none", sm: "grid" },
                    placeItems: "center",
                    bgcolor: "#ffedd5",
                    color: "#c2410c",
                    flexShrink: 0,
                  }}
                >
                  <AccessTimeRoundedIcon fontSize="small" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                    {canCloseDay ? "Encerrar expediente" : "Marcar como concluído"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {canCloseDay
                      ? "Registra a saída desta data e tira o dia do estado pendente."
                      : "Mantém os horários reais e remove o alerta negativo do dia; o banco segue pelo total semanal."}
                  </Typography>
                </Box>
                <Button
                  color="warning"
                  onClick={canCloseDay ? closeDayDirectly : completeWithoutDebit}
                  size="small"
                  startIcon={<AccessTimeRoundedIcon fontSize="small" />}
                  sx={{
                    borderRadius: "8px",
                    fontWeight: 900,
                    px: 1.4,
                    whiteSpace: "nowrap",
                  }}
                  variant="contained"
                >
                  {canCloseDay ? "Encerrar dia" : "Concluir dia"}
                </Button>
              </Stack>
            </Box>
          )}

          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.7 }}
            transition={{ duration: 0.2 }}
            sx={{
              borderRadius: "10px",
              border: `1px solid ${isMedicalLeave ? "#fecdd3" : nanaColors.line}`,
              bgcolor: isMedicalLeave ? "#fff1f2" : "#ffffff",
              p: 1.25,
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1, alignItems: { xs: "stretch", sm: "center" } }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                  Atestado médico
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Justifica a ausência por consulta, declaração ou atestado médico.
                </Typography>
              </Box>
              <Button
                color={isMedicalLeave ? "error" : "inherit"}
                onClick={toggleMedicalLeave}
                size="small"
                startIcon={<LocalHospitalRoundedIcon fontSize="small" />}
                sx={{
                  borderRadius: "8px",
                  whiteSpace: "nowrap",
                  bgcolor: isMedicalLeave ? undefined : "#fff1f2",
                  color: isMedicalLeave ? undefined : "#be123c",
                }}
                variant={isMedicalLeave ? "contained" : "outlined"}
              >
                {isMedicalLeave ? "Remover" : "Marcar"}
              </Button>
            </Stack>
          </Box>

          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.7 }}
            transition={{ duration: 0.2 }}
            sx={{
              borderRadius: "10px",
              border: `1px solid ${isExcluded ? "#94a3b8" : nanaColors.line}`,
              bgcolor: isExcluded ? "#f8fafc" : "#ffffff",
              p: 1.25,
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1, alignItems: { xs: "stretch", sm: "center" } }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                  Dia limpo
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ignora esta data no banco de horas sem apagar o histórico.
                </Typography>
              </Box>
              <Button
                color={isExcluded ? "secondary" : "inherit"}
                onClick={toggleExcludedDay}
                size="small"
                startIcon={<DeleteSweepRoundedIcon fontSize="small" />}
                sx={{
                  borderRadius: "8px",
                  whiteSpace: "nowrap",
                  bgcolor: isExcluded ? undefined : "#f1f5f9",
                  color: isExcluded ? undefined : "#475569",
                }}
                variant={isExcluded ? "contained" : "outlined"}
              >
                {isExcluded ? "Restaurar" : "Limpar dia"}
              </Button>
            </Stack>
          </Box>

          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.7 }}
            transition={{ duration: 0.2 }}
            sx={{
              borderRadius: "10px",
              border: `1px solid ${nanaColors.line}`,
              bgcolor: "#f8fafc",
              p: 1.25,
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1, alignItems: { xs: "stretch", sm: "center" } }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                  Lançar nesta data
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Adicione pontos ou pausas retroativas e os totais serão recalculados.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  onClick={addTime}
                  size="small"
                  startIcon={<AddRoundedIcon fontSize="small" />}
                  sx={{ borderRadius: "8px", whiteSpace: "nowrap" }}
                  variant="contained"
                >
                  Ponto
                </Button>
                <Button
                  color="secondary"
                  onClick={addBreak}
                  size="small"
                  startIcon={<AddRoundedIcon fontSize="small" />}
                  sx={{ borderRadius: "8px", whiteSpace: "nowrap" }}
                  variant="outlined"
                >
                  Pausa
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.7 }}
            transition={{ duration: 0.2 }}
            sx={{
              borderRadius: "10px",
              border: `1px solid ${isHoliday ? "#c4b5fd" : nanaColors.line}`,
              bgcolor: isHoliday ? "#f5f3ff" : "#ffffff",
              p: 1.25,
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1, alignItems: { xs: "stretch", sm: "center" } }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                  Feriado
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Marque a data para aparecer nos resumos como feriado.
                </Typography>
              </Box>
              <Button
                color={isHoliday ? "warning" : "secondary"}
                onClick={toggleHoliday}
                size="small"
                startIcon={<EventBusyRoundedIcon fontSize="small" />}
                sx={{ borderRadius: "8px", whiteSpace: "nowrap" }}
                variant={isHoliday ? "outlined" : "contained"}
              >
                {isHoliday ? "Remover" : "Marcar"}
              </Button>
            </Stack>
          </Box>

          <Box>
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1.25,
              }}
            >
              <Typography sx={{ fontWeight: 900 }}>Histórico do dia</Typography>
              {hasRecords && (
                <Chip
                  label={`${recordCount} registros`}
                  size="small"
                  sx={{
                    bgcolor: "#f1f5f9",
                    color: "#334155",
                    height: 24,
                  }}
                />
              )}
            </Stack>
            {!hasRecords ? (
              <EmptyDayState />
            ) : (
              <RecordMiniList
                entries={day.entries}
                breaks={day.breaks}
                onEdit={edit}
              />
            )}
          </Box>
        </Stack>
      </Box>
      {hasRecords && recordCount > 3 && (
        <Box
          sx={{
            height: 16,
            mt: "-16px",
            pointerEvents: "none",
            background: "linear-gradient(180deg, rgba(255,255,255,0), #ffffff)",
            zIndex: 1,
          }}
        />
      )}
    </Box>
  );
}

function CalendarNavButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        onClick={onClick}
        size="small"
        sx={{
          width: 36,
          height: 36,
          borderRadius: "8px",
          border: `1px solid ${nanaColors.line}`,
          bgcolor: "#ffffff",
          color: "text.secondary",
          "&:hover": {
            bgcolor: nanaColors.surfaceAlt,
            color: "primary.main",
          },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

function PopoverMetric({
  label,
  value,
  color,
  surface,
}: {
  label: string;
  value: string;
  color: string;
  surface: string;
}) {
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      viewport={{ once: false, amount: 0.7 }}
      transition={{ duration: 0.2 }}
      sx={{
        minHeight: 70,
        borderRadius: "8px",
        border: `1px solid ${nanaColors.line}`,
        bgcolor: surface,
        px: 1.25,
        py: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxShadow: "0 6px 16px rgba(36, 50, 40, 0.05)",
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontWeight: 800, lineHeight: 1.1 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          color,
          fontWeight: 900,
          fontSize: "0.88rem",
          lineHeight: 1.15,
          mt: 0.5,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function EmptyDayState() {
  return (
    <Box
      sx={{
        borderRadius: "10px",
        border: `1px dashed ${nanaColors.line}`,
        bgcolor: nanaColors.surfaceAlt,
        px: 2,
        py: 2.25,
        textAlign: "center",
      }}
    >
      <CalendarMonthRoundedIcon
        sx={{
          color: nanaColors.amber,
          bgcolor: "#ffffff",
          borderRadius: "50%",
          p: 0.75,
          fontSize: 38,
          boxShadow: "0 8px 24px rgba(245, 158, 11, 0.2)",
          mb: 1,
        }}
      />
      <Typography sx={{ fontWeight: 900 }}>Sem registros nesta data</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
        Quando houver ponto ou pausa, o resumo aparece aqui.
      </Typography>
    </Box>
  );
}

function Legend() {
  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
      <Chip label="Hoje" sx={{ bgcolor: nanaColors.amberSoft }} />
      <Chip label="Completo" sx={{ bgcolor: nanaColors.greenSoft }} />
      <Chip label="Excedeu" color="secondary" />
      <Chip label="Atenção" color="warning" />
      <Chip label="Feriado" sx={{ bgcolor: "#f5f3ff", color: "#6d28d9" }} />
      <Chip label="Dia limpo" sx={{ bgcolor: "#f1f5f9", color: "#475569" }} />
      <Chip label="Atestado" sx={{ bgcolor: "#fff1f2", color: "#be123c" }} />
      <Chip label="Sem registro" />
    </Stack>
  );
}

function RecordMiniList({
  entries,
  breaks,
  onEdit,
}: {
  entries: TimeEntry[];
  breaks: BreakEntry[];
  onEdit: (target: EditTarget) => void;
}) {
  const entryTones: Record<TimeEntry["type"], { accent: string; surface: string }> = {
    arrival: { accent: "#2563eb", surface: "#dbeafe" },
    lunch_start: { accent: "#d97706", surface: "#ffedd5" },
    lunch_end: { accent: "#0f766e", surface: "#ccfbf1" },
    break_start: { accent: "#7c3aed", surface: "#ede9fe" },
    break_end: { accent: "#0891b2", surface: "#cffafe" },
    departure: { accent: "#4f46e5", surface: "#e0e7ff" },
  };
  const breakTones: Record<BreakCategory, { accent: string; surface: string }> = {
    lunch: { accent: "#d97706", surface: "#ffedd5" },
    medical: { accent: "#dc2626", surface: "#fee2e2" },
    sick: { accent: "#be123c", surface: "#ffe4e6" },
    travel: { accent: "#0284c7", surface: "#e0f2fe" },
    personal: { accent: "#7c3aed", surface: "#ede9fe" },
    other: { accent: "#475569", surface: "#f1f5f9" },
  };
  const records = [
    ...entries.map((entry) => {
      const tone = entryTones[entry.type];
      return {
        id: `time-${entry.id}`,
        at: entry.occurredAt,
        time: formatTimePtBr(entry.occurredAt),
        label: actionLabels[entry.type],
        caption: entry.note,
        isModified: entry.isModified,
        tone,
        onEdit: () => onEdit({ kind: "time", entry }),
      };
    }),
    ...breaks.map((entry) => {
      const tone = breakTones[entry.category];
      return {
        id: `break-${entry.id}`,
        at: entry.startsAt,
        time: `${formatTimePtBr(entry.startsAt)}-${entry.endsAt ? formatTimePtBr(entry.endsAt) : "aberta"}`,
        label: breakLabels[entry.category],
        caption: entry.note,
        isModified: entry.isModified,
        tone,
        onEdit: () => onEdit({ kind: "break", entry }),
      };
    }),
  ].sort((first, second) => first.at.localeCompare(second.at));

  if (records.length === 0) return null;

  return (
    <Stack spacing={1.1}>
      {records.map((record) => (
        <Box
          component={motion.div}
          key={record.id}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          whileHover={{ x: 3, boxShadow: "0 12px 26px rgba(36, 50, 40, 0.11)" }}
          viewport={{ once: false, amount: 0.45 }}
          transition={{ duration: 0.2 }}
          sx={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 1.25,
            borderRadius: "8px",
            border: `1px solid ${nanaColors.line}`,
            bgcolor: "#ffffff",
            px: 1.25,
            py: 1,
            boxShadow: "0 8px 22px rgba(64, 42, 12, 0.06)",
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 42,
              borderRadius: "6px",
              display: "grid",
              placeItems: "center",
              bgcolor: record.tone.surface,
              color: record.tone.accent,
              fontWeight: 900,
              fontSize: "0.72rem",
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            {record.time}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
            >
              <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                {record.label}
              </Typography>
              {record.isModified && (
                <Chip
                  label="editado"
                  size="small"
                  sx={{
                    height: 22,
                    bgcolor: "#fff3e0",
                    color: "#b45309",
                    "& .MuiChip-label": { px: 0.8 },
                  }}
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {record.time}
            </Typography>
            {record.caption && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.35 }}
              >
                {record.caption}
              </Typography>
            )}
          </Box>
          <Button
            aria-label={`Editar ${record.label}`}
            color="primary"
            size="small"
            onClick={record.onEdit}
            startIcon={<EditRoundedIcon fontSize="small" />}
            sx={{
              borderRadius: "8px",
              bgcolor: "#f8fafc",
              color: record.tone.accent,
              minWidth: 0,
              px: 1.1,
              "&:hover": { bgcolor: record.tone.surface },
            }}
          >
            Editar
          </Button>
        </Box>
      ))}
    </Stack>
  );
}

function HourBankView({ tracker }: { tracker: ReturnType<typeof useTimeTracker> }) {
  const [selectedMovementId, setSelectedMovementId] = useState<string | null | undefined>(
    undefined,
  );
  const expandedMovementId =
    selectedMovementId === undefined
      ? tracker.movements[0]?.id ?? null
      : selectedMovementId &&
          tracker.movements.some((movement) => movement.id === selectedMovementId)
        ? selectedMovementId
        : null;
  const balanceSeries = buildBalanceSeries(
    tracker.movements.length > 0
      ? tracker.movements.map((movement) => movement.minutesDelta)
      : [tracker.hourBankBalance],
  );
  const isBalancePositive = tracker.hourBankBalance >= 0;

  return (
    <Stack spacing={2}>
      <SectionTitle title="Banco de horas" subtitle="Créditos e débitos semanais" />
      {tracker.hasHourBankMovements ? (
        <MotionCard variants={fadeUp} initial="hidden" animate="visible">
          <CardContent sx={{ p: 2.2 }}>
            <Stack spacing={1.2}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                <Typography color="text.secondary">Saldo atual</Typography>
                <Chip
                  label={isBalancePositive ? "Crédito" : "Débito"}
                  sx={{
                    bgcolor: isBalancePositive ? "#dcfce7" : "#ffe4e6",
                    color: isBalancePositive ? "#166534" : "#9f1239",
                    fontWeight: 900,
                  }}
                />
              </Stack>
              <RollingCounter
                value={minutesToClockDisplay(Math.abs(tracker.hourBankBalance))}
                label={tracker.hourBankBalance >= 0 ? "Saldo acumulado" : "Débito acumulado"}
              />
              <Typography
                component={motion.div}
                key={`bank-sign-${tracker.hourBankBalance >= 0 ? "plus" : "minus"}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                sx={{
                  fontWeight: 900,
                  color: tracker.hourBankBalance >= 0 ? "#166534" : "#9f1239",
                }}
              >
                {tracker.hourBankBalance >= 0 ? "+" : "-"}
                {minutesToHoursLabel(Math.abs(tracker.hourBankBalance))}
              </Typography>
              <BalanceFlowChart values={balanceSeries} positive={isBalancePositive} />
              <Typography color="text.secondary">
                A curva mostra o desenho dos ultimos movimentos do banco contra a jornada semanal.
              </Typography>
            </Stack>
          </CardContent>
        </MotionCard>
      ) : (
        <Alert severity="info">
          Nenhum movimento de banco de horas foi gerado ainda.
        </Alert>
      )}
      <Stack spacing={1.5}>
        {tracker.movements.map((movement, index) => {
          const details = movement.details ?? [];
          const isExpanded = expandedMovementId === movement.id;
          const detailsCount = details.length;
          const isCredit = movement.minutesDelta >= 0;
          const tone = isCredit
            ? {
                border: "#e2e8f0",
                header: "#f8fafc",
                headerActive: "#f1f5f9",
                text: "#047857",
                chip: "#dcfce7",
              }
            : {
                border: "#e2e8f0",
                header: "#f8fafc",
                headerActive: "#f1f5f9",
                text: "#c2410c",
                chip: "#ffedd5",
              };

          return (
            <MotionCard
              key={movement.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{
                y: -2,
                boxShadow: "0 16px 36px rgba(64, 42, 12, 0.12)",
              }}
              viewport={{ once: false, amount: 0.18 }}
              transition={{ duration: 0.24, delay: Math.min(index * 0.03, 0.18) }}
              sx={{
                borderRadius: "8px",
                border: `1px solid ${isExpanded ? tone.border : nanaColors.line}`,
                boxShadow: isExpanded
                  ? "0 14px 34px rgba(64, 42, 12, 0.10)"
                  : "0 8px 22px rgba(64, 42, 12, 0.06)",
                overflow: "hidden",
              }}
            >
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              <Stack spacing={1.4}>
                <Stack
                  component={motion.button}
                  type="button"
                  whileTap={{ scale: 0.995 }}
                  onClick={() => setSelectedMovementId(isExpanded ? null : movement.id)}
                  direction="row"
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    border: 0,
                    borderBottom: isExpanded ? `1px solid ${tone.border}` : "none",
                    bgcolor: isExpanded ? tone.headerActive : tone.header,
                    color: "inherit",
                    cursor: "pointer",
                    font: "inherit",
                    px: 1.25,
                    py: 1.05,
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: "6px",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "#ffffff",
                        border: `1px solid ${tone.border}`,
                        color: tone.text,
                        flexShrink: 0,
                      }}
                    >
                      <ExpandMoreRoundedIcon
                        fontSize="small"
                        sx={{
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 180ms ease",
                        }}
                      />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Typography sx={{ fontWeight: 800 }}>{movement.description}</Typography>
                      {movement.source === "weekly_balance" && (
                        <Chip
                          label="automático"
                          size="small"
                          sx={{
                            borderRadius: "6px",
                            bgcolor: "#eef2ff",
                            color: "#4338ca",
                          }}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateFullPtBr(movement.date)}
                    </Typography>
                    </Box>
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: "center", flexShrink: 0 }}
                  >
                    <Chip
                      label={detailsCount}
                      size="small"
                      icon={<SavingsRoundedIcon fontSize="small" />}
                      sx={{
                        borderRadius: "6px",
                        bgcolor: "#ffffff",
                        color: "#334155",
                        fontWeight: 900,
                        "& .MuiChip-icon": { color: "#334155", ml: 0.6 },
                      }}
                    />
                    <Chip
                      label={minutesToHoursLabel(movement.minutesDelta)}
                      size="small"
                      sx={{
                        borderRadius: "6px",
                        bgcolor: tone.chip,
                        color: tone.text,
                        fontWeight: 900,
                      }}
                    />
                  </Stack>
                </Stack>
                {detailsCount > 0 && (
                  <>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ bgcolor: "#ffffff", px: 1.25, py: 1.2 }}>
                        <Stack spacing={1.15}>
                          <Stack
                            direction="row"
                            sx={{
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 1,
                            }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              Detalhes do movimento
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: tone.text, fontWeight: 900 }}
                            >
                              {detailsCount} dias contabilizados
                            </Typography>
                          </Stack>
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                              gap: 0.85,
                            }}
                          >
                        {details.map((day, detailIndex) => (
                          <HourBankDayTile
                            day={day}
                            index={detailIndex}
                            key={`${movement.id}-${day.date}`}
                          />
                        ))}
                          </Box>
                        </Stack>
                      </Box>
                    </Collapse>
                  </>
                )}
              </Stack>
            </CardContent>
            </MotionCard>
          );
        })}
      </Stack>
    </Stack>
  );
}

function getHourBankDayTone(day: DailySummary) {
  const hasRecords = day.entries.length > 0 || day.breaks.length > 0;

  if (day.mark?.type === "medical_leave") {
    return {
      label: "Atestado",
      accent: "#be123c",
      badge: "#ffe4e6",
    };
  }

  if (day.mark?.type === "excluded") {
    return {
      label: "Limpo",
      accent: "#475569",
      badge: "#f1f5f9",
    };
  }

  if (day.mark?.type === "holiday") {
    return {
      label: "Feriado",
      accent: "#6d28d9",
      badge: "#ede9fe",
    };
  }

  if (isCompletedWithoutDailyTarget(day)) {
    return {
      label: "Concluído",
      accent: "#047857",
      badge: "#dcfce7",
    };
  }

  if (hasRecords && day.status !== "closed") {
    return {
      label: "Pendente",
      accent: "#b45309",
      badge: "#fef3c7",
    };
  }

  if (day.balanceMinutes < 0) {
    return {
      label: "Débito",
      accent: "#dc2626",
      badge: "#ffe4e6",
    };
  }

  if (day.balanceMinutes > 0) {
    return {
      label: "Crédito",
      accent: "#047857",
      badge: "#dcfce7",
    };
  }

  return {
    label: hasRecords ? "Fechado" : "Sem registro",
    accent: "#2563eb",
    badge: "#e0f2fe",
  };
}

function HourBankDayTile({ day, index }: { day: DailySummary; index: number }) {
  const tone = getHourBankDayTone(day);
  const balanceLabel =
    isCompletedWithoutDailyTarget(day)
      ? `${minutesToHoursLabel(day.workedMinutes)} contabilizadas nas 30h`
      : day.balanceMinutes === 0
        ? "Saldo 0min"
        : `Saldo ${minutesToHoursLabel(day.balanceMinutes)}`;
  const workedLabel =
    (day.mark?.type === "holiday" ||
      day.mark?.type === "excluded" ||
      day.mark?.type === "medical_leave") &&
    day.workedMinutes === 0
      ? tone.label
      : minutesToHoursLabel(day.workedMinutes);

  return (
    <Box
      component={motion.article}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 14px 28px rgba(36, 50, 40, 0.10)" }}
      viewport={{ once: false, amount: 0.45 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.12) }}
      sx={{
        minHeight: 156,
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        bgcolor: "#f5f5f5",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 1.4, py: 1.25, flex: 1 }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
              {formatWeekdayLongPtBr(day.date)}
            </Typography>
            <Typography sx={{ fontWeight: 900, lineHeight: 1.15, color: "#111827" }}>
              {formatDatePtBr(day.date)}
            </Typography>
          </Box>
          <Chip
            label={workedLabel}
            size="small"
            sx={{
              borderRadius: "8px",
              bgcolor: "#ffffff",
              color: "#374151",
              flexShrink: 0,
              fontWeight: 900,
              boxShadow: "inset 0 0 0 1px #e5e7eb",
            }}
          />
        </Stack>
        <Typography
          variant="body2"
          sx={{
            color: "#4b5563",
            lineHeight: 1.4,
            mt: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {getHourBankDetailLabel(day)}
        </Typography>
      </Box>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mt: "auto",
          bgcolor: "#eeeeee",
          borderTop: "1px solid #e5e7eb",
          px: 1.4,
          py: 0.95,
        }}
      >
        <Chip
          label={tone.label}
          size="small"
          sx={{
            borderRadius: "8px",
            bgcolor: tone.badge,
            color: tone.accent,
            fontWeight: 900,
            maxWidth: "54%",
          }}
        />
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: tone.accent,
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900 }}>
            {balanceLabel}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

function getHourBankDetailLabel(day: DailySummary) {
  if (day.mark?.type === "medical_leave") {
    return day.entries.length === 0 && day.breaks.length === 0
      ? "Atestado médico"
      : "Atestado médico · registros preservados";
  }

  if (day.mark?.type === "excluded") {
    return day.entries.length === 0 && day.breaks.length === 0
      ? "Dia limpo"
      : "Dia limpo · registros preservados";
  }

  if (day.mark?.type === "holiday" && day.entries.length === 0 && day.breaks.length === 0) {
    return "Feriado";
  }

  if (isCompletedWithoutDailyTarget(day)) {
    return `Dia concluído · ${minutesToHoursLabel(day.workedMinutes)} contabilizadas nas 30h semanais`;
  }

  if (day.entries.length === 0 && day.breaks.length === 0) {
    return "Sem registros";
  }

  const entryLabels = [...day.entries]
    .sort((first, second) => first.occurredAt.localeCompare(second.occurredAt))
    .map((entry) => `${actionLabels[entry.type]} ${formatTimePtBr(entry.occurredAt)}`);
  const breakLabelsForDay = [...day.breaks]
    .sort((first, second) => first.startsAt.localeCompare(second.startsAt))
    .map((entry) => {
      const end = entry.endsAt ? formatTimePtBr(entry.endsAt) : "aberta";
      return `${breakLabels[entry.category]} ${formatTimePtBr(entry.startsAt)}-${end}`;
    });

  return [...entryLabels, ...breakLabelsForDay].join(" · ");
}

function HistoryView({
  tracker,
  onAddBreak,
  onAddTime,
  onEdit,
  onOpenDirectClose,
  onToggleExcludedDay,
  onToggleMedicalLeave,
}: {
  tracker: ReturnType<typeof useTimeTracker>;
  onAddBreak: (date: string) => void;
  onAddTime: (date: string) => void;
  onEdit: (target: EditTarget) => void;
  onOpenDirectClose: (date: string) => void;
  onToggleExcludedDay: (date: string) => Promise<void>;
  onToggleMedicalLeave: (date: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [limitFilter, setLimitFilter] = useState<HistoryLimitFilter>("all");
  const [entryType, setEntryType] = useState<TimeEntry["type"] | "all">("all");
  const [breakCategory, setBreakCategory] = useState<BreakCategory | "all">("all");
  const [manualRecordDate, setManualRecordDate] = useState(tracker.todayKey);
  const [page, setPage] = useState(1);
  const [expandedHistoryDate, setExpandedHistoryDate] = useState<
    string | "none" | null
  >(null);
  const deferredSearch = useDeferredValue(search);
  const pageSize = 5;
  const workedThisMonth = tracker.dailySummaries.reduce(
    (total, day) => total + day.workedMinutes,
    0,
  );
  const registeredDays = tracker.historySummaries;
  const hasCurrentMonthEntries = tracker.dailySummaries.some(
    (day) => day.entries.length > 0 || day.breaks.length > 0,
  );
  const monthLabel = hasCurrentMonthEntries
    ? minutesToHoursLabel(workedThisMonth)
    : "Sem registros";
  const pausesLabel = tracker.breaks.length > 0
    ? String(tracker.breaks.length)
    : "Sem pausas";
  const filteredDays = registeredDays.filter((day) => {
    const matchesSearch = recordMatchesSearch(day, deferredSearch);
    const matchesStart = !startDate || day.date >= startDate;
    const matchesEnd = !endDate || day.date <= endDate;
    const matchesEntryType =
      entryType === "all" || day.entries.some((entry) => entry.type === entryType);
    const matchesBreakCategory =
      breakCategory === "all" ||
      day.breaks.some((entry) => entry.category === breakCategory);
    const matchesLimit =
      limitFilter === "all" ||
      (limitFilter === "exceeded" && day.balanceMinutes > 0) ||
      (limitFilter === "negative" && day.balanceMinutes < 0) ||
      (limitFilter === "pending" && day.status !== "closed") ||
      (limitFilter === "complete" && day.status === "closed") ||
      (limitFilter === "edited" &&
        [...day.entries, ...day.breaks].some((entry) => entry.isModified)) ||
      (limitFilter === "holiday" && day.mark?.type === "holiday") ||
      (limitFilter === "excluded" && day.mark?.type === "excluded") ||
      (limitFilter === "medical_leave" && day.mark?.type === "medical_leave");

    return (
      matchesSearch &&
      matchesStart &&
      matchesEnd &&
      matchesEntryType &&
      matchesBreakCategory &&
      matchesLimit
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredDays.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleDays = filteredDays.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const defaultExpandedDate = visibleDays[0]?.date ?? null;
  const expandedDate =
    expandedHistoryDate === "none"
      ? null
      : expandedHistoryDate &&
          visibleDays.some((day) => day.date === expandedHistoryDate)
        ? expandedHistoryDate
        : defaultExpandedDate;
  const hasActiveFilters =
    search ||
    startDate ||
    endDate ||
    limitFilter !== "all" ||
    entryType !== "all" ||
    breakCategory !== "all";
  const historyGroups = visibleDays.reduce<
    { monthKey: string; days: typeof registeredDays; workedMinutes: number }[]
  >((groups, day) => {
    const monthKey = day.date.slice(0, 7);
    const currentGroup = groups.find((group) => group.monthKey === monthKey);

    if (currentGroup) {
      currentGroup.days.push(day);
      currentGroup.workedMinutes += day.workedMinutes;
      return groups;
    }

    groups.push({
      monthKey,
      days: [day],
      workedMinutes: day.workedMinutes,
    });

    return groups;
  }, []);

  function resetFilters() {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setLimitFilter("all");
    setEntryType("all");
    setBreakCategory("all");
    setPage(1);
    setExpandedHistoryDate(null);
  }

  function resetPageAndExpansion() {
    setPage(1);
    setExpandedHistoryDate(null);
  }

  return (
    <Stack spacing={2}>
      <SectionTitle title="Histórico" subtitle="Resumo mensal e rastreabilidade" />
      <SummaryGrid
        items={[
          ["Mês", monthLabel, "Horas registradas"],
          [
            "Semana",
            tracker.hasWeekEntries
              ? minutesToHoursLabel(tracker.weekWorkedMinutes)
              : "Sem registros",
            "Horas registradas",
          ],
          ["Pausas", pausesLabel, "Registradas"],
        ]}
      />
      <HistoryFilters
        breakCategory={breakCategory}
        endDate={endDate}
        entryType={entryType}
        hasActiveFilters={Boolean(hasActiveFilters)}
        limitFilter={limitFilter}
        manualRecordDate={manualRecordDate}
        resultCount={filteredDays.length}
        search={search}
        startDate={startDate}
        onAddBreak={onAddBreak}
        onAddTime={onAddTime}
        onToggleExcludedDay={onToggleExcludedDay}
        onToggleMedicalLeave={onToggleMedicalLeave}
        onBreakCategoryChange={(value) => {
          setBreakCategory(value);
          resetPageAndExpansion();
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          resetPageAndExpansion();
        }}
        onEntryTypeChange={(value) => {
          setEntryType(value);
          resetPageAndExpansion();
        }}
        onLimitFilterChange={(value) => {
          setLimitFilter(value);
          resetPageAndExpansion();
        }}
        onManualRecordDateChange={setManualRecordDate}
        onReset={resetFilters}
        onSearchChange={(value) => {
          setSearch(value);
          resetPageAndExpansion();
        }}
        onStartDateChange={(value) => {
          setStartDate(value);
          resetPageAndExpansion();
        }}
      />
      {registeredDays.length === 0 && (
        <Alert severity="info">Nenhum registro salvo neste mês ainda.</Alert>
      )}
      {registeredDays.length > 0 && filteredDays.length === 0 && (
        <Alert severity="info">
          Nenhum dia encontrado com os filtros selecionados.
        </Alert>
      )}
      {historyGroups.map((group) => (
        <Stack
          component={motion.section}
          key={group.monthKey}
          spacing={1.2}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.18 }}
          transition={{ duration: motionDuration.medium, ease: motionEasing.standard }}
          sx={{ position: "relative", pl: { xs: 0, sm: 0.6 } }}
        >
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              left: { xs: 0, sm: -1 },
              top: 34,
              bottom: 6,
              width: 2,
              borderRadius: 999,
              bgcolor: "rgba(37, 99, 235, 0.22)",
              display: { xs: "none", sm: "block" },
            }}
          />
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 900, letterSpacing: "-0.01em" }}>
                {formatMonthPtBr(new Date(`${group.monthKey}-01T12:00:00`))}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {group.days.length} dias com registros
              </Typography>
            </Box>
            <Chip
              label={minutesToHoursLabel(group.workedMinutes)}
              color="secondary"
              sx={{ borderRadius: "8px" }}
            />
          </Stack>
          {group.days.map((day, index) => (
            <HistoryDayCard
              day={day}
              expanded={expandedDate === day.date}
              index={index}
              key={day.date}
              onEdit={onEdit}
              onOpenDirectClose={onOpenDirectClose}
              onToggleExcludedDay={onToggleExcludedDay}
              onToggleMedicalLeave={onToggleMedicalLeave}
              onToggle={() =>
                setExpandedHistoryDate(
                  expandedDate === day.date ? "none" : day.date,
                )
              }
            />
          ))}
        </Stack>
      ))}
      {filteredDays.length > pageSize && (
        <HistoryPagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredDays.length}
          totalPages={totalPages}
          onNext={() => {
            setPage((current) => Math.min(current + 1, totalPages));
            setExpandedHistoryDate(null);
          }}
          onPrevious={() => {
            setPage((current) => Math.max(current - 1, 1));
            setExpandedHistoryDate(null);
          }}
        />
      )}
    </Stack>
  );
}

function HistoryFilters({
  breakCategory,
  endDate,
  entryType,
  hasActiveFilters,
  limitFilter,
  manualRecordDate,
  resultCount,
  search,
  startDate,
  onAddBreak,
  onAddTime,
  onToggleExcludedDay,
  onToggleMedicalLeave,
  onBreakCategoryChange,
  onEndDateChange,
  onEntryTypeChange,
  onLimitFilterChange,
  onManualRecordDateChange,
  onReset,
  onSearchChange,
  onStartDateChange,
}: {
  breakCategory: BreakCategory | "all";
  endDate: string;
  entryType: TimeEntry["type"] | "all";
  hasActiveFilters: boolean;
  limitFilter: HistoryLimitFilter;
  manualRecordDate: string;
  resultCount: number;
  search: string;
  startDate: string;
  onAddBreak: (date: string) => void;
  onAddTime: (date: string) => void;
  onToggleExcludedDay: (date: string) => Promise<void>;
  onToggleMedicalLeave: (date: string) => Promise<void>;
  onBreakCategoryChange: (value: BreakCategory | "all") => void;
  onEndDateChange: (value: string) => void;
  onEntryTypeChange: (value: TimeEntry["type"] | "all") => void;
  onLimitFilterChange: (value: HistoryLimitFilter) => void;
  onManualRecordDateChange: (value: string) => void;
  onReset: () => void;
  onSearchChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <FilterListRoundedIcon color="primary" />
              <Box>
                <Typography sx={{ fontWeight: 900 }}>Filtros</Typography>
                <Typography variant="body2" color="text.secondary">
                  {resultCount} dias encontrados
                </Typography>
              </Box>
            </Stack>
            <Button
              disabled={!hasActiveFilters}
              onClick={onReset}
              size="small"
              sx={{ borderRadius: "8px" }}
            >
              Limpar
            </Button>
          </Stack>
          <TextField
            label="Buscar"
            placeholder="Dia, horário, observação..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            fullWidth
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              gap: 1,
            }}
          >
            <TextField
              label="Data inicial"
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="Data final"
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Situação</InputLabel>
              <Select
                label="Situação"
                value={limitFilter}
                onChange={(event) =>
                  onLimitFilterChange(event.target.value as HistoryLimitFilter)
                }
              >
                <MenuItem value="all">Todas</MenuItem>
                <MenuItem value="exceeded">Passou do limite</MenuItem>
                <MenuItem value="negative">Saldo negativo</MenuItem>
                <MenuItem value="pending">Pendentes</MenuItem>
                <MenuItem value="complete">Fechados</MenuItem>
                <MenuItem value="edited">Editados</MenuItem>
                <MenuItem value="holiday">Feriados</MenuItem>
                <MenuItem value="excluded">Dias limpos</MenuItem>
                <MenuItem value="medical_leave">Atestados médicos</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Registro</InputLabel>
              <Select
                label="Registro"
                value={entryType}
                onChange={(event) =>
                  onEntryTypeChange(event.target.value as TimeEntry["type"] | "all")
                }
              >
                <MenuItem value="all">Todos</MenuItem>
                {Object.entries(actionLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ gridColumn: { sm: "1 / -1" } }}>
              <InputLabel>Pausa</InputLabel>
              <Select
                label="Pausa"
                value={breakCategory}
                onChange={(event) =>
                  onBreakCategoryChange(event.target.value as BreakCategory | "all")
                }
              >
                <MenuItem value="all">Todas</MenuItem>
                {Object.entries(breakLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box
            component={motion.div}
            whileHover={{ y: -2 }}
            sx={{
              borderRadius: "10px",
              border: `1px solid ${nanaColors.line}`,
              bgcolor: "#f8fafc",
              p: 1.25,
            }}
          >
            <Stack spacing={1.2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <AddRoundedIcon color="primary" fontSize="small" />
                <Box>
                  <Typography sx={{ fontWeight: 900 }}>
                    Novo registro retroativo
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Escolha uma data e lance pontos ou pausas mesmo que o dia esteja vazio.
                  </Typography>
                </Box>
              </Stack>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{ gap: 1, alignItems: { xs: "stretch", sm: "center" } }}
              >
                <TextField
                  label="Data do lançamento"
                  type="date"
                  value={manualRecordDate}
                  onChange={(event) => onManualRecordDateChange(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ flex: 1 }}
                />
                <Button
                  disabled={!manualRecordDate}
                  onClick={() => onAddTime(manualRecordDate)}
                  startIcon={<AddRoundedIcon fontSize="small" />}
                  sx={{ borderRadius: "8px", minHeight: 48, whiteSpace: "nowrap" }}
                  variant="contained"
                >
                  Adicionar ponto
                </Button>
                <Button
                  color="secondary"
                  disabled={!manualRecordDate}
                  onClick={() => onAddBreak(manualRecordDate)}
                  startIcon={<AddRoundedIcon fontSize="small" />}
                  sx={{ borderRadius: "8px", minHeight: 48, whiteSpace: "nowrap" }}
                  variant="outlined"
                >
                  Adicionar pausa
                </Button>
                <Button
                  disabled={!manualRecordDate}
                  onClick={() => void onToggleExcludedDay(manualRecordDate)}
                  startIcon={<DeleteSweepRoundedIcon fontSize="small" />}
                  sx={{
                    borderRadius: "8px",
                    minHeight: 48,
                    whiteSpace: "nowrap",
                    color: "#475569",
                    borderColor: "#cbd5e1",
                  }}
                  variant="outlined"
                >
                  Limpar dia
                </Button>
                <Button
                  disabled={!manualRecordDate}
                  onClick={() => void onToggleMedicalLeave(manualRecordDate)}
                  startIcon={<LocalHospitalRoundedIcon fontSize="small" />}
                  sx={{
                    borderRadius: "8px",
                    minHeight: 48,
                    whiteSpace: "nowrap",
                    color: "#be123c",
                    borderColor: "#fecdd3",
                    bgcolor: "#fff1f2",
                  }}
                  variant="outlined"
                >
                  Atestado
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function HistoryDayCard({
  day,
  index,
  expanded,
  onEdit,
  onOpenDirectClose,
  onToggleExcludedDay,
  onToggleMedicalLeave,
  onToggle,
}: {
  day: DailySummary;
  index: number;
  expanded: boolean;
  onEdit: (target: EditTarget) => void;
  onOpenDirectClose: (date: string) => void;
  onToggleExcludedDay: (date: string) => Promise<void>;
  onToggleMedicalLeave: (date: string) => Promise<void>;
  onToggle: () => void;
}) {
  const sortedEntries = [...day.entries].sort((first, second) =>
    first.occurredAt.localeCompare(second.occurredAt),
  );
  const arrival = sortedEntries.find((entry) => entry.type === "arrival");
  const departure = sortedEntries.find((entry) => entry.type === "departure");
  const lunchStart = sortedEntries.find((entry) => entry.type === "lunch_start");
  const lunchEnd = sortedEntries.find((entry) => entry.type === "lunch_end");
  const hasEdits = [...day.entries, ...day.breaks].some((entry) => entry.isModified);
  const isHoliday = day.mark?.type === "holiday";
  const isExcluded = day.mark?.type === "excluded";
  const isMedicalLeave = day.mark?.type === "medical_leave";
  const canCloseDay = canCloseEntriesDirectly(day.entries);

  return (
    <Card
      component={motion.article}
      initial={{ opacity: 0, x: 14, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      whileHover={{ y: -3, boxShadow: "0 24px 48px rgba(15, 23, 42, 0.12)" }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{
        duration: motionDuration.medium,
        ease: motionEasing.standard,
        delay: Math.min(index * 0.06, 0.24),
      }}
      sx={{
        position: "relative",
        borderRadius: "14px",
        overflow: "visible",
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          width: 11,
          height: 11,
          borderRadius: "50%",
          left: -8,
          top: 24,
          bgcolor: "#2563eb",
          boxShadow: "0 0 0 4px rgba(37, 99, 235, 0.16)",
          display: { xs: "none", sm: "block" },
        }}
      />
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>{formatDatePtBr(day.date)}</Typography>
              <Typography color="text.secondary">
                {formatWeekdayLongPtBr(day.date)} · {statusLabels[day.status]}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start" }}>
              {isHoliday && (
                <Chip
                  icon={<EventBusyRoundedIcon fontSize="small" />}
                  label="feriado"
                  size="small"
                  sx={{
                    borderRadius: "6px",
                    bgcolor: "#f5f3ff",
                    color: "#6d28d9",
                  }}
                />
              )}
              {isExcluded && (
                <Chip
                  icon={<DeleteSweepRoundedIcon fontSize="small" />}
                  label="dia limpo"
                  size="small"
                  sx={{
                    borderRadius: "6px",
                    bgcolor: "#f1f5f9",
                    color: "#475569",
                  }}
                />
              )}
              {isMedicalLeave && (
                <Chip
                  icon={<LocalHospitalRoundedIcon fontSize="small" />}
                  label="atestado"
                  size="small"
                  sx={{
                    borderRadius: "6px",
                    bgcolor: "#fff1f2",
                    color: "#be123c",
                  }}
                />
              )}
              {hasEdits && (
                <Chip label="editado" color="warning" size="small" />
              )}
              <Chip
                label={
                  isExcluded || isMedicalLeave
                    ? "ignorado"
                    : minutesToHoursLabel(day.workedMinutes)
                }
                color={isExcluded || isMedicalLeave ? "default" : "secondary"}
              />
            </Stack>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
              gap: 1,
            }}
          >
            <HistoryMiniMetric
              label="Entrada"
              value={arrival ? formatTimePtBr(arrival.occurredAt) : "-"}
            />
            <HistoryMiniMetric
              label="Almoço"
              value={
                lunchStart || lunchEnd
                  ? `${lunchStart ? formatTimePtBr(lunchStart.occurredAt) : "--:--"}-${
                      lunchEnd ? formatTimePtBr(lunchEnd.occurredAt) : "--:--"
                    }`
                  : "-"
              }
            />
            <HistoryMiniMetric
              label="Saída"
              value={departure ? formatTimePtBr(departure.occurredAt) : "-"}
            />
            <HistoryMiniMetric label="Pausas" value={String(day.breaks.length)} />
          </Box>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            <Button
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? `Recolher registros de ${formatDatePtBr(day.date)}`
                  : `Expandir registros de ${formatDatePtBr(day.date)}`
              }
              color="secondary"
              endIcon={
                <ExpandMoreRoundedIcon
                  sx={{
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                  }}
                />
              }
              onClick={onToggle}
              sx={{
                borderRadius: "8px",
                px: 1.25,
              }}
              variant={expanded ? "contained" : "outlined"}
            >
              {expanded ? "Ocultar registros" : "Ver registros"}
            </Button>
            <Button
              color={isExcluded ? "secondary" : "inherit"}
              onClick={() => void onToggleExcludedDay(day.date)}
              startIcon={<DeleteSweepRoundedIcon fontSize="small" />}
              sx={{
                borderRadius: "8px",
                px: 1.25,
                color: isExcluded ? undefined : "#475569",
                borderColor: isExcluded ? undefined : "#cbd5e1",
              }}
              variant={isExcluded ? "contained" : "outlined"}
            >
              {isExcluded ? "Restaurar dia" : "Limpar dia"}
            </Button>
            {canCloseDay && (
              <Button
                color="warning"
                onClick={() => onOpenDirectClose(day.date)}
                sx={{
                  borderRadius: "8px",
                  px: 1.25,
                }}
                variant="outlined"
              >
                Encerrar dia
              </Button>
            )}
            <Button
              color={isMedicalLeave ? "error" : "inherit"}
              onClick={() => void onToggleMedicalLeave(day.date)}
              startIcon={<LocalHospitalRoundedIcon fontSize="small" />}
              sx={{
                borderRadius: "8px",
                px: 1.25,
                color: isMedicalLeave ? undefined : "#be123c",
                borderColor: isMedicalLeave ? undefined : "#fecdd3",
                bgcolor: isMedicalLeave ? undefined : "#fff1f2",
              }}
              variant={isMedicalLeave ? "contained" : "outlined"}
            >
              {isMedicalLeave ? "Remover atestado" : "Atestado"}
            </Button>
          </Stack>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Stack spacing={1.5} sx={{ pt: 0.25 }}>
              <Divider />
              <RecordMiniList
                entries={day.entries}
                breaks={day.breaks}
                onEdit={onEdit}
              />
            </Stack>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
}

function HistoryMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        border: `1px solid ${nanaColors.line}`,
        borderRadius: "8px",
        bgcolor: "#f8fafc",
        px: 1,
        py: 0.85,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>{value}</Typography>
    </Box>
  );
}

function HistoryPagination({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  onNext,
  onPrevious,
}: {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <Card>
      <CardContent sx={{ py: 1.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Exibindo {firstItem}-{lastItem} de {totalItems} dias
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              disabled={currentPage <= 1}
              onClick={onPrevious}
              variant="outlined"
              sx={{ borderRadius: "8px" }}
              fullWidth
            >
              Anterior
            </Button>
            <Chip label={`${currentPage}/${totalPages}`} sx={{ borderRadius: "8px" }} />
            <Button
              disabled={currentPage >= totalPages}
              onClick={onNext}
              variant="contained"
              sx={{ borderRadius: "8px" }}
              fullWidth
            >
              Próxima
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ProfileView({
  displayName,
  session,
  onLogout,
}: {
  displayName: string;
  session: Session | null;
  onLogout: () => void;
}) {
  return (
    <Stack spacing={2}>
      <SectionTitle title="Perfil e ajustes" subtitle="Preferências da conta" />
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography>
              Jornada de referência: <strong>30 horas semanais</strong>.
            </Typography>
            <Typography>
              Nome: <strong>{displayName}</strong>
            </Typography>
            <Typography color="text.secondary">
              Você está conectada como {session?.user.email ?? "usuária autenticada"}.
              Seus registros ficam vinculados à sua conta.
            </Typography>
            <Button variant="outlined" color="secondary" onClick={onLogout}>
              Sair
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box component={motion.div} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Typography variant="h4" sx={{ letterSpacing: "-0.03em" }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.2 }}>
        {subtitle}
      </Typography>
    </Box>
  );
}

function BottomAppNavigation({
  tab,
  shouldReduceMotion,
  onChange,
}: {
  tab: Tab;
  shouldReduceMotion: boolean;
  onChange: (tab: Tab) => void;
}) {
  return (
    <AppBar
      component="nav"
      aria-label="Navegação principal"
      position="fixed"
      color="transparent"
      elevation={0}
      sx={{
        top: "auto",
        bottom: 0,
        pointerEvents: "none",
        background:
          "linear-gradient(180deg, rgba(243,239,229,0) 0%, rgba(243,239,229,0.92) 48%, #f3efe5 100%)",
        px: { xs: 0.75, sm: 1.5 },
        pt: { xs: 1.25, sm: 1.5 },
        pb: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      <Box
        component={motion.div}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: shouldReduceMotion ? 0 : motionDuration.medium,
          ease: motionEasing.standard,
        }}
        sx={{
          width: "100%",
          maxWidth: 540,
          mx: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: { xs: 0.2, sm: 0.35 },
          borderRadius: { xs: "19px", sm: "20px" },
          border: "1px solid rgba(218,220,224,0.88)",
          bgcolor: "rgba(255,255,255,0.9)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.96), 0 2px 8px rgba(17,24,39,0.06), 0 14px 34px rgba(17,24,39,0.13)",
          backdropFilter: "blur(20px) saturate(145%)",
          WebkitBackdropFilter: "blur(20px) saturate(145%)",
          isolation: "isolate",
          p: 0.45,
          pointerEvents: "auto",
        }}
      >
        {bottomAppNavigationItems.map((item) => {
          const isActive = item.value === tab;

          return (
            <Box
              component={motion.button}
              key={item.value}
              type="button"
              aria-current={isActive ? "page" : undefined}
              aria-label={`Abrir ${item.label}`}
              onClick={() => onChange(item.value)}
              whileHover={shouldReduceMotion ? undefined : { y: -1 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              transition={springy}
              sx={{
                appearance: "none",
                alignItems: "center",
                bgcolor: "transparent",
                border: 0,
                borderRadius: { xs: "14px", sm: "15px" },
                color: isActive ? "#ffffff" : "#707682",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                font: "inherit",
                gap: 0.15,
                justifyContent: "center",
                minHeight: { xs: 50, sm: 52 },
                minWidth: 0,
                overflow: "hidden",
                p: { xs: "4px 2px 5px", sm: "5px 5px 6px" },
                position: "relative",
                WebkitTapHighlightColor: "transparent",
                transition:
                  "color 160ms cubic-bezier(0.2, 0, 0, 1), background-color 160ms cubic-bezier(0.2, 0, 0, 1)",
                "&:hover": {
                  bgcolor: isActive ? "transparent" : "rgba(17,24,39,0.045)",
                  color: isActive ? "#ffffff" : "#111827",
                },
                "&:focus-visible": {
                  outline: "2px solid rgba(120,201,242,0.82)",
                  outlineOffset: 2,
                },
              }}
            >
              {isActive ? (
                <Box
                  component={motion.span}
                  layoutId="bottom-navigation-active"
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 34, mass: 0.84 }
                  }
                  sx={{
                    position: "absolute",
                    inset: 1,
                    border: "1px solid #15171b",
                    borderRadius: "inherit",
                    background:
                      "radial-gradient(circle at 82% 0%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 32%), #050505",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.12), 0 5px 14px rgba(5,5,5,0.18)",
                    zIndex: 0,
                  }}
                />
              ) : null}

              <Box
                component={motion.span}
                animate={{
                  color: isActive ? item.accent : "#707682",
                  y: isActive && !shouldReduceMotion ? -0.5 : 0,
                }}
                transition={{ duration: shouldReduceMotion ? 0 : motionDuration.fast }}
                sx={{
                  alignItems: "center",
                  display: "flex",
                  height: { xs: 21, sm: 22 },
                  justifyContent: "center",
                  position: "relative",
                  zIndex: 1,
                  "& .MuiSvgIcon-root": {
                    fontSize: { xs: "1.18rem", sm: "1.28rem" },
                  },
                }}
              >
                {item.icon}
              </Box>

              <Typography
                component="span"
                sx={{
                  color: "inherit",
                  fontSize: { xs: "clamp(0.53rem, 2.45vw, 0.62rem)", sm: "0.66rem" },
                  fontWeight: isActive ? 850 : 760,
                  letterSpacing: isActive ? "0.005em" : 0,
                  lineHeight: 1,
                  maxWidth: "100%",
                  overflow: "hidden",
                  position: "relative",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  zIndex: 1,
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </AppBar>
  );
}

function EditRecordDialog({
  target,
  onClose,
  onSubmitTime,
  onSubmitBreak,
}: {
  target: EditTarget | null;
  onClose: () => void;
  onSubmitTime: (
    entryId: string,
    type: TimeEntry["type"],
    occurredAt: string,
    note?: string,
  ) => Promise<void>;
  onSubmitBreak: (
    breakId: string,
    category: BreakCategory,
    startsAt: string,
    endsAt: string,
    note?: string,
  ) => Promise<void>;
}) {
  const isBreak = target?.kind === "break";

  return (
    <Dialog open={Boolean(target)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {isBreak ? "Editar pausa" : "Editar registro"}
      </DialogTitle>
      {target && (
        <EditRecordFields
          key={`${target.kind}-${target.entry.id}`}
          target={target}
          onClose={onClose}
          onSubmitTime={onSubmitTime}
          onSubmitBreak={onSubmitBreak}
        />
      )}
    </Dialog>
  );
}

function EditRecordFields({
  target,
  onClose,
  onSubmitTime,
  onSubmitBreak,
}: {
  target: EditTarget;
  onClose: () => void;
  onSubmitTime: (
    entryId: string,
    type: TimeEntry["type"],
    occurredAt: string,
    note?: string,
  ) => Promise<void>;
  onSubmitBreak: (
    breakId: string,
    category: BreakCategory,
    startsAt: string,
    endsAt: string,
    note?: string,
  ) => Promise<void>;
}) {
  const isBreak = target.kind === "break";
  const [type, setType] = useState<TimeEntry["type"]>(
    target.kind === "time" ? target.entry.type : "arrival",
  );
  const [category, setCategory] = useState<BreakCategory>(
    target.kind === "break" ? target.entry.category : "personal",
  );
  const [date, setDate] = useState(
    target.kind === "time"
      ? toDateInputValue(target.entry.occurredAt)
      : toDateInputValue(target.entry.startsAt),
  );
  const [time, setTime] = useState(
    target.kind === "time"
      ? toTimeInputValue(target.entry.occurredAt)
      : toTimeInputValue(target.entry.startsAt),
  );
  const [endTime, setEndTime] = useState(
    target.kind === "break"
      ? toTimeInputValue(target.entry.endsAt ?? target.entry.startsAt)
      : "",
  );
  const [note, setNote] = useState(target.entry.note ?? "");

  function submit() {
    if (!date || !time) return;

    if (target.kind === "time") {
      void onSubmitTime(
        target.entry.id,
        type,
        toEditableIso(date, time),
        note || undefined,
      ).then(onClose);
      return;
    }

    if (!endTime) return;

    void onSubmitBreak(
      target.entry.id,
      category,
      toEditableIso(date, time),
      toEditableIso(date, endTime),
      note || undefined,
    ).then(onClose);
  }

  return (
    <>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {isBreak ? (
            <FormControl fullWidth>
              <InputLabel>Tipo de pausa</InputLabel>
              <Select
                label="Tipo de pausa"
                value={category}
                onChange={(event) => setCategory(event.target.value as BreakCategory)}
              >
                {Object.entries(breakLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <FormControl fullWidth>
              <InputLabel>Tipo de registro</InputLabel>
              <Select
                label="Tipo de registro"
                value={type}
                onChange={(event) => setType(event.target.value as TimeEntry["type"])}
              >
                {Object.entries(actionLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            label="Data"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            fullWidth
          />
          <TextField
            label={isBreak ? "Horário inicial" : "Horário"}
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            fullWidth
          />
          {isBreak && (
            <TextField
              label="Horário final"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              fullWidth
            />
          )}
          <TextField
            label="Observação opcional"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
          />
          <Alert severity="info">
            Ao salvar, o item fica marcado como editado e os totais são
            recalculados com os novos horários.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={submit}>
          Salvar edição
        </Button>
      </DialogActions>
    </>
  );
}

function AddRecordDialog({
  target,
  onClose,
  onSubmitTime,
  onSubmitBreak,
}: {
  target: AddRecordTarget | null;
  onClose: () => void;
  onSubmitTime: (
    type: TimeEntry["type"],
    occurredAt: string,
    note?: string,
  ) => Promise<void>;
  onSubmitBreak: (
    category: BreakCategory,
    startsAt: string,
    endsAt: string,
    note?: string,
  ) => Promise<void>;
}) {
  const isBreak = target?.kind === "break";

  return (
    <Dialog open={Boolean(target)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {isBreak ? "Adicionar pausa retroativa" : "Adicionar registro retroativo"}
      </DialogTitle>
      {target && (
        <AddRecordFields
          key={`${target.kind}-${target.date}`}
          target={target}
          onClose={onClose}
          onSubmitTime={onSubmitTime}
          onSubmitBreak={onSubmitBreak}
        />
      )}
    </Dialog>
  );
}

function AddRecordFields({
  target,
  onClose,
  onSubmitTime,
  onSubmitBreak,
}: {
  target: AddRecordTarget;
  onClose: () => void;
  onSubmitTime: (
    type: TimeEntry["type"],
    occurredAt: string,
    note?: string,
  ) => Promise<void>;
  onSubmitBreak: (
    category: BreakCategory,
    startsAt: string,
    endsAt: string,
    note?: string,
  ) => Promise<void>;
}) {
  const currentTime = new Date().toTimeString().slice(0, 5);
  const isBreak = target.kind === "break";
  const [type, setType] = useState<TimeEntry["type"]>("arrival");
  const [category, setCategory] = useState<BreakCategory>("lunch");
  const [date, setDate] = useState(target.date);
  const [time, setTime] = useState(currentTime);
  const [endTime, setEndTime] = useState(currentTime);
  const [note, setNote] = useState("");

  function submit() {
    if (!date || !time) return;

    if (target.kind === "time") {
      void onSubmitTime(type, toEditableIso(date, time), note || undefined).then(
        onClose,
      );
      return;
    }

    if (!endTime) return;

    void onSubmitBreak(
      category,
      toEditableIso(date, time),
      toEditableIso(date, endTime),
      note || undefined,
    ).then(onClose);
  }

  return (
    <>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {isBreak ? (
            <FormControl fullWidth>
              <InputLabel>Tipo de pausa</InputLabel>
              <Select
                label="Tipo de pausa"
                value={category}
                onChange={(event) => setCategory(event.target.value as BreakCategory)}
              >
                {Object.entries(breakLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <FormControl fullWidth>
              <InputLabel>Tipo de registro</InputLabel>
              <Select
                label="Tipo de registro"
                value={type}
                onChange={(event) => setType(event.target.value as TimeEntry["type"])}
              >
                {Object.entries(actionLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            label="Data"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            label={isBreak ? "Horário inicial" : "Horário"}
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          {isBreak && (
            <TextField
              label="Horário final"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          )}
          <TextField
            label="Observação opcional"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
          />
          <Alert severity="info">
            O lançamento será salvo no Supabase e os totais do dia, mês,
            histórico e calendário serão recalculados após salvar.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={submit}>
          Salvar registro
        </Button>
      </DialogActions>
    </>
  );
}

function EntryDialog({
  open,
  nextType,
  date,
  onClose,
  onSubmit,
}: {
  open: boolean;
  nextType: TimeEntry["type"] | "pause" | null;
  date: string;
  onClose: () => void;
  onSubmit: (type: TimeEntry["type"], occurredAt: string, note?: string) => Promise<void>;
}) {
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [note, setNote] = useState("");

  function submit() {
    if (!nextType || nextType === "pause") return;
    void onSubmit(
      nextType,
      new Date(`${date}T${time}:00`).toISOString(),
      note || undefined,
    ).then(onClose);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{nextType && nextType !== "pause" ? actionLabels[nextType] : "Registrar ponto"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Horário"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            fullWidth
          />
          <TextField
            label="Observação opcional"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={submit}>
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BreakDialog({
  open,
  date,
  onClose,
  onSubmit,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  onSubmit: (
    category: BreakCategory,
    startsAt: string,
    endsAt: string,
    note?: string,
  ) => Promise<void>;
}) {
  const [category, setCategory] = useState<BreakCategory>("personal");
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [endTime, setEndTime] = useState(new Date().toTimeString().slice(0, 5));
  const [note, setNote] = useState("");

  function submit() {
    void onSubmit(
      category,
      new Date(`${date}T${time}:00`).toISOString(),
      new Date(`${date}T${endTime}:00`).toISOString(),
      note || undefined,
    ).then(onClose);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Registrar pausa</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Tipo de pausa</InputLabel>
            <Select
              label="Tipo de pausa"
              value={category}
              onChange={(event) => setCategory(event.target.value as BreakCategory)}
            >
              {Object.entries(breakLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Horário inicial"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
          <TextField
            label="Horário final"
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
          <TextField
            label="Observação opcional"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={submit}>
          Registrar pausa
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DirectCloseDayDialog({
  open,
  date,
  onClose,
  onSubmit,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  onSubmit: (type: TimeEntry["type"], occurredAt: string, note?: string) => Promise<void>;
}) {
  const [time, setTime] = useState(() =>
    date === toDateKey(new Date()) ? new Date().toTimeString().slice(0, 5) : "18:00",
  );
  const [note, setNote] = useState("Encerramento direto do expediente");

  function submit() {
    void onSubmit(
      "departure",
      new Date(`${date}T${time}:00`).toISOString(),
      note || undefined,
    ).then(onClose);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Encerrar expediente?</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="warning">
            Isso vai fechar o dia neste horário, sem exigir saída para almoço ou
            retorno. Use quando a jornada já puder ser encerrada.
          </Alert>
          <TextField
            label="Horário de encerramento"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            label="Observação opcional"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button color="warning" variant="contained" onClick={submit}>
          Confirmar encerramento
        </Button>
      </DialogActions>
    </Dialog>
  );
}
