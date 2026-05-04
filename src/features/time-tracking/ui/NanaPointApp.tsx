"use client";

import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import type { Session } from "@supabase/supabase-js";
import {
  Alert,
  AppBar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
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
import { useEffect, useState } from "react";
import {
  formatDatePtBr,
  formatDateFullPtBr,
  formatMonthPtBr,
  formatTimePtBr,
  formatWeekdayLongPtBr,
  formatWeekdayShortPtBr,
  minutesToDecimalHours,
  minutesToHoursLabel,
  toDateKey,
} from "@/domain/time/format";
import type {
  BreakCategory,
  BreakEntry,
  DailySummary,
  TimeEntry,
} from "@/domain/time/types";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { fadeUp, springy, staggerContainer } from "@/shared/motion/presets";
import { nanaColors } from "@/shared/theme/nana-theme";
import { upsertUserProfile } from "../data/time-tracking-repository";
import { useTimeTracker } from "../model/use-time-tracker";

type Tab = "today" | "calendar" | "bank" | "history" | "profile";

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
  | "holiday";

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

const MotionCard = motion(Card);

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

export function NanaPointApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(() => hasSupabaseConfig());
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [addTarget, setAddTarget] = useState<AddRecordTarget | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const supabase = hasSupabaseConfig() ? getSupabaseBrowserClient() : null;
  const tracker = useTimeTracker({
    supabase,
    userId: session?.user.id ?? null,
  });

  const transition = shouldReduceMotion ? { duration: 0 } : springy;

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
        background:
          "radial-gradient(circle at top left, rgba(245, 124, 0, 0.18), transparent 32rem), linear-gradient(180deg, #fffaf3 0%, #f5fbf2 100%)",
        pb: 11,
      }}
    >
      <Container maxWidth="sm" sx={{ px: { xs: 1.25, sm: 2 }, py: { xs: 1.75, sm: 2.5 } }}>
        <AppHeader
          bankBalance={tracker.hourBankBalance}
          displayName={displayName}
          hasHourBankMovements={tracker.hasHourBankMovements}
        />

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
                tracker={tracker}
                onOpenEntry={() => setEntryDialogOpen(true)}
                onOpenBreak={() => setBreakDialogOpen(true)}
                transition={transition}
              />
            )}
            {tab === "calendar" && (
              <CalendarView
                tracker={tracker}
                onAddBreak={(date) => setAddTarget({ kind: "break", date })}
                onAddTime={(date) => setAddTarget({ kind: "time", date })}
                onEdit={setEditTarget}
                onToggleHoliday={tracker.toggleHoliday}
              />
            )}
            {tab === "bank" && <HourBankView tracker={tracker} />}
            {tab === "history" && (
              <HistoryView
                tracker={tracker}
                onAddBreak={(date) => setAddTarget({ kind: "break", date })}
                onAddTime={(date) => setAddTarget({ kind: "time", date })}
                onEdit={setEditTarget}
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

      <BottomAppNavigation tab={tab} onChange={setTab} />
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

function AppHeader({
  bankBalance,
  displayName,
  hasHourBankMovements,
}: {
  bankBalance: number;
  displayName: string;
  hasHourBankMovements: boolean;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          Nana&apos;s Point
        </Typography>
        <Typography variant="h5">Olá, {getFirstName(displayName)}</Typography>
      </Box>
      <Chip
        icon={<SavingsRoundedIcon />}
        label={hasHourBankMovements ? minutesToHoursLabel(bankBalance) : "Sem saldo"}
        color={bankBalance >= 0 ? "secondary" : "warning"}
      />
    </Stack>
  );
}

function TodayView({
  tracker,
  onOpenEntry,
  onOpenBreak,
  transition,
}: {
  tracker: ReturnType<typeof useTimeTracker>;
  onOpenEntry: () => void;
  onOpenBreak: () => void;
  transition: object;
}) {
  const summary = tracker.todaySummary;
  const buttonLabel =
    tracker.nextEntryType && tracker.nextEntryType !== "pause"
      ? actionLabels[tracker.nextEntryType]
      : "Dia registrado";
  const weekDeltaLabel =
    tracker.hasWeekEntries && tracker.weekReferenceDelta > 0
      ? minutesToHoursLabel(tracker.weekReferenceDelta)
      : tracker.hasWeekEntries
        ? "Em aberto"
        : "Sem registros";
  const weekDeltaCaption =
    tracker.hasWeekEntries && tracker.weekReferenceDelta > 0
      ? "Acima da jornada"
      : "Semana não fechada";
  const bankLabel = tracker.hasHourBankMovements
    ? minutesToHoursLabel(tracker.hourBankBalance)
    : "Sem saldo";

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="visible">
      <Stack spacing={2}>
        <MotionCard variants={fadeUp} transition={transition}>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography color="text.secondary">
                    {formatDatePtBr(tracker.todayKey)}
                  </Typography>
                  <Typography variant="h4">{statusLabels[summary.status]}</Typography>
                </Box>
                <AccessTimeRoundedIcon color="primary" fontSize="large" />
              </Stack>
              <Typography variant="h2">
                {minutesToDecimalHours(summary.workedMinutes)}h
              </Typography>
              <Typography color="text.secondary">
                {tracker.hasTodayEntries
                  ? `${minutesToHoursLabel(summary.breakMinutes)} em pausas registradas hoje.`
                  : "Nenhum ponto registrado hoje ainda."}
              </Typography>
              {tracker.error && <Alert severity="error">{tracker.error}</Alert>}
              <Stack direction="row" spacing={1}>
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  disabled={!tracker.nextEntryType || tracker.state === "loading"}
                  onClick={onOpenEntry}
                  component={motion.button}
                  whileTap={{ scale: 0.97 }}
                >
                  {tracker.state === "loading" ? "Salvando..." : buttonLabel}
                </Button>
                <Button
                  size="large"
                  color="secondary"
                  variant="outlined"
                  disabled={tracker.state === "loading"}
                  onClick={onOpenBreak}
                  component={motion.button}
                  whileTap={{ scale: 0.97 }}
                >
                  Pausa
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </MotionCard>

        <SummaryGrid
          items={[
            [
              "Semana",
              tracker.hasWeekEntries
                ? minutesToHoursLabel(tracker.weekWorkedMinutes)
                : "Sem registros",
              "Horas registradas",
            ],
            ["Saldo semanal", weekDeltaLabel, weekDeltaCaption],
            ["Banco", bankLabel, "Movimentos lançados"],
          ]}
        />
      </Stack>
    </motion.section>
  );
}

function SummaryGrid({ items }: { items: [string, string, string][] }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.2 }}>
      {items.map(([title, value, caption]) => (
        <MotionCard key={title} variants={fadeUp}>
          <CardContent sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h6">{value}</Typography>
            <Typography variant="caption" color="text.secondary">
              {caption}
            </Typography>
          </CardContent>
        </MotionCard>
      ))}
    </Box>
  );
}

function CalendarView({
  tracker,
  onAddBreak,
  onAddTime,
  onEdit,
  onToggleHoliday,
}: {
  tracker: ReturnType<typeof useTimeTracker>;
  onAddBreak: (date: string) => void;
  onAddTime: (date: string) => void;
  onEdit: (target: EditTarget) => void;
  onToggleHoliday: (date: string) => Promise<void>;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const colors = {
    today: nanaColors.orange,
    complete: nanaColors.green,
    exceeded: "#43a047",
    negative: "#fb8c00",
    pending: "#ef6c00",
    holiday: "#7c3aed",
    empty: "#d8d1c6",
  };
  const selectedDay =
    tracker.calendarDays.find((day) => day.date === selectedDate) ?? null;
  const popoverOpen = Boolean(anchorEl && selectedDay);
  const isCurrentMonth =
    tracker.calendarMonth.getFullYear() === tracker.today.getFullYear() &&
    tracker.calendarMonth.getMonth() === tracker.today.getMonth();

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
      <Card>
        <CardContent>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
            {tracker.calendarDays.map((day, index) => (
              <Tooltip
                arrow
                disableHoverListener={
                  !day.mark && day.entries.length === 0 && day.breaks.length === 0
                }
                key={day.date}
                title={<CalendarDayTooltip day={day} />}
              >
                <Box
                  component={motion.button}
                  type="button"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ delay: index * 0.012 }}
                  onClick={(event) => openDay(event, day.date)}
                  sx={{
                    aspectRatio: "1",
                    minHeight: 54,
                    borderRadius: "12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.3,
                    bgcolor:
                      day.status === "holiday"
                        ? "#f5f3ff"
                        : day.status === "empty"
                          ? "#fffaf3"
                          : "#ffffff",
                    border: `2px solid ${colors[day.status]}`,
                    color: day.status === "empty" ? "text.secondary" : "text.primary",
                    position: "relative",
                    fontWeight: 800,
                    cursor: "pointer",
                    font: "inherit",
                    p: 0.5,
                    boxShadow:
                      day.status === "empty"
                        ? "inset 0 0 0 1px rgba(36, 50, 40, 0.03)"
                        : "0 7px 18px rgba(64, 42, 12, 0.08)",
                    "&:hover": {
                      bgcolor: "#ffffff",
                      boxShadow: "0 12px 28px rgba(64, 42, 12, 0.16)",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 900, lineHeight: 1 }}>
                    {formatWeekdayShortPtBr(day.date)}
                  </Typography>
                  <Typography sx={{ fontWeight: 900, lineHeight: 1 }}>
                    {day.day}
                  </Typography>
                  {day.mark?.type === "holiday" && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#6d28d9",
                        fontSize: "0.56rem",
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                    >
                      FER
                    </Typography>
                  )}
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      bgcolor: colors[day.status],
                      position: "absolute",
                      bottom: 7,
                    }}
                  />
                </Box>
              </Tooltip>
            ))}
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
            onToggleHoliday={onToggleHoliday}
          />
        )}
      </Popover>
      <Legend />
    </Stack>
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
  onToggleHoliday,
}: {
  day: ReturnType<typeof useTimeTracker>["calendarDays"][number];
  onAddBreak: (date: string) => void;
  onAddTime: (date: string) => void;
  onEdit: (target: EditTarget) => void;
  onAfterEdit: () => void;
  onToggleHoliday: (date: string) => Promise<void>;
}) {
  const hasRecords = day.entries.length > 0 || day.breaks.length > 0;
  const isHoliday = day.mark?.type === "holiday";
  const balanceLabel =
    day.balanceMinutes === 0
      ? "0min"
      : minutesToHoursLabel(day.balanceMinutes);
  const statusColor =
    isHoliday
      ? "#7c3aed"
      : day.status === "empty"
      ? nanaColors.muted
      : day.status === "negative" || day.status === "pending"
        ? "#d97706"
        : "#2563eb";
  const recordCount = day.entries.length + day.breaks.length;

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

  function toggleHoliday() {
    void onToggleHoliday(day.date).then(onAfterEdit);
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
          </Box>
          <IconButton
            aria-label="Fechar detalhes do dia"
            onClick={onAfterEdit}
            size="small"
            sx={{
              border: `1px solid ${nanaColors.line}`,
              borderRadius: "8px",
              color: "text.secondary",
              "&:hover": { bgcolor: nanaColors.cream },
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
              {isHoliday ? "Feriado" : statusLabels[day.dayStatus]}
            </Typography>
            <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", lineHeight: 1.2 }}>
              {minutesToHoursLabel(day.workedMinutes)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {day.balanceMinutes === 0
                ? "Sem saldo no dia"
                : `${balanceLabel} de saldo`}
            </Typography>
          </Box>
          <Chip
            label={isHoliday ? "feriado" : hasRecords ? `${recordCount} itens` : "vazio"}
            size="small"
            sx={{
              borderRadius: "6px",
              bgcolor: isHoliday ? "#f5f3ff" : hasRecords ? "#eef2ff" : "#f3f0ea",
              color: isHoliday ? "#6d28d9" : hasRecords ? "#4338ca" : nanaColors.muted,
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
              surface="#f5f3ff"
              value={isHoliday ? "Feriado" : statusLabels[day.dayStatus]}
            />
            <PopoverMetric
              color="#0f766e"
              label="Jornada"
              surface="#f0fdfa"
              value={minutesToHoursLabel(day.workedMinutes)}
            />
            <PopoverMetric
              color={day.balanceMinutes < 0 ? "#d97706" : "#4f46e5"}
              label="Saldo"
              surface={day.balanceMinutes < 0 ? "#fff7ed" : "#eef2ff"}
              value={balanceLabel}
            />
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
            bgcolor: nanaColors.cream,
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
        bgcolor: nanaColors.cream,
        px: 2,
        py: 2.25,
        textAlign: "center",
      }}
    >
      <CalendarMonthRoundedIcon
        sx={{
          color: nanaColors.orange,
          bgcolor: "#ffffff",
          borderRadius: "50%",
          p: 0.75,
          fontSize: 38,
          boxShadow: "0 8px 24px rgba(245, 124, 0, 0.18)",
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
      <Chip label="Hoje" sx={{ bgcolor: nanaColors.orangeSoft }} />
      <Chip label="Completo" sx={{ bgcolor: nanaColors.greenSoft }} />
      <Chip label="Excedeu" color="secondary" />
      <Chip label="Atenção" color="warning" />
      <Chip label="Feriado" sx={{ bgcolor: "#f5f3ff", color: "#6d28d9" }} />
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
  return (
    <Stack spacing={2}>
      <SectionTitle title="Banco de horas" subtitle="Créditos e débitos semanais" />
      {tracker.hasHourBankMovements ? (
        <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography color="text.secondary">Saldo atual</Typography>
          <Typography
            component={motion.h2}
            key={tracker.hourBankBalance}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            variant="h2"
            color={tracker.hourBankBalance >= 0 ? "secondary.main" : "warning.main"}
          >
            {minutesToHoursLabel(tracker.hourBankBalance)}
          </Typography>
          <Typography color="text.secondary">
            Soma créditos e débitos automáticos contra o limite de 30h semanais.
          </Typography>
        </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          Nenhum movimento de banco de horas foi gerado ainda.
        </Alert>
      )}
      <Stack spacing={1.5}>
        {tracker.movements.map((movement) => (
          <Card key={movement.id}>
            <CardContent>
              <Stack spacing={1.4}>
                <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                  <Box>
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
                  <Chip
                    label={minutesToHoursLabel(movement.minutesDelta)}
                    color={movement.minutesDelta >= 0 ? "secondary" : "warning"}
                    sx={{ borderRadius: "8px" }}
                  />
                </Stack>
                {movement.details && movement.details.length > 0 && (
                  <Stack spacing={0.8}>
                    {movement.details.map((day) => (
                      <Box
                        key={`${movement.id}-${day.date}`}
                        sx={{
                          border: `1px solid ${nanaColors.line}`,
                          borderRadius: "8px",
                          bgcolor: "#f8fafc",
                          px: 1,
                          py: 0.85,
                        }}
                      >
                        <Stack
                          direction="row"
                          sx={{ justifyContent: "space-between", gap: 1.5 }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 900 }}>
                              {formatDateFullPtBr(day.date)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {getHourBankDetailLabel(day)}
                            </Typography>
                          </Box>
                          {day.mark?.type === "holiday" && day.workedMinutes === 0 ? (
                            <Chip
                              label="isento"
                              size="small"
                              sx={{
                                borderRadius: "6px",
                                flexShrink: 0,
                                bgcolor: "#f5f3ff",
                                color: "#6d28d9",
                              }}
                            />
                          ) : (
                            <Chip
                              label={minutesToHoursLabel(day.workedMinutes)}
                              size="small"
                              sx={{ borderRadius: "6px", flexShrink: 0 }}
                            />
                          )}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function getHourBankDetailLabel(day: DailySummary) {
  if (day.mark?.type === "holiday" && day.entries.length === 0 && day.breaks.length === 0) {
    return "Feriado";
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
}: {
  tracker: ReturnType<typeof useTimeTracker>;
  onAddBreak: (date: string) => void;
  onAddTime: (date: string) => void;
  onEdit: (target: EditTarget) => void;
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
    const matchesSearch = recordMatchesSearch(day, search);
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
      (limitFilter === "holiday" && day.mark?.type === "holiday");

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
        <Stack key={group.monthKey} spacing={1.2}>
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 900 }}>
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
          {group.days.map((day) => (
            <HistoryDayCard
              day={day}
              expanded={expandedDate === day.date}
              key={day.date}
              onEdit={onEdit}
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
  expanded,
  onEdit,
  onToggle,
}: {
  day: DailySummary;
  expanded: boolean;
  onEdit: (target: EditTarget) => void;
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

  return (
    <Card component={motion.article} whileHover={{ y: -2 }}>
      <CardContent>
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
              {hasEdits && (
                <Chip label="editado" color="warning" size="small" />
              )}
              <Chip label={minutesToHoursLabel(day.workedMinutes)} color="secondary" />
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
              alignSelf: "flex-start",
              borderRadius: "8px",
              px: 1.25,
            }}
            variant={expanded ? "contained" : "outlined"}
          >
            {expanded ? "Ocultar registros" : "Ver registros"}
          </Button>
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
    <Box>
      <Typography variant="h4">{title}</Typography>
      <Typography color="text.secondary">{subtitle}</Typography>
    </Box>
  );
}

function BottomAppNavigation({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <AppBar
      position="fixed"
      color="transparent"
      elevation={0}
      sx={{ top: "auto", bottom: 0, p: { xs: 1, sm: 1.5 }, backdropFilter: "blur(18px)" }}
    >
      <BottomNavigation
        value={tab}
        onChange={(_, next) => onChange(next)}
        showLabels
        sx={{
          width: "100%",
          maxWidth: 520,
          mx: "auto",
          borderRadius: 999,
          border: `1px solid ${nanaColors.line}`,
          boxShadow: "0 16px 40px rgba(64, 42, 12, 0.14)",
          px: { xs: 0.5, sm: 1 },
          "& .MuiBottomNavigationAction-root": {
            minWidth: 0,
            maxWidth: "none",
            px: { xs: 0.4, sm: 1 },
            py: { xs: 0.5, sm: 0.75 },
          },
          "& .MuiBottomNavigationAction-label": {
            fontSize: { xs: "0.62rem", sm: "0.72rem" },
          },
          "& .MuiSvgIcon-root": {
            fontSize: { xs: "1.15rem", sm: "1.35rem" },
          },
        }}
      >
        <BottomNavigationAction label="Hoje" value="today" icon={<HomeRoundedIcon />} />
        <BottomNavigationAction label="Calendário" value="calendar" icon={<CalendarMonthRoundedIcon />} />
        <BottomNavigationAction label="Banco" value="bank" icon={<SavingsRoundedIcon />} />
        <BottomNavigationAction label="Histórico" value="history" icon={<InsightsRoundedIcon />} />
        <BottomNavigationAction label="Perfil" value="profile" icon={<PersonRoundedIcon />} />
      </BottomNavigation>
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
