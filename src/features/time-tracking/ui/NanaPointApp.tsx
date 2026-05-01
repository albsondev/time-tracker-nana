"use client";

import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
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
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
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
  formatMonthPtBr,
  formatTimePtBr,
  formatWeekdayLongPtBr,
  formatWeekdayShortPtBr,
  minutesToDecimalHours,
  minutesToHoursLabel,
} from "@/domain/time/format";
import type { BreakCategory, BreakEntry, TimeEntry } from "@/domain/time/types";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { fadeUp, springy, staggerContainer } from "@/shared/motion/presets";
import { nanaColors } from "@/shared/theme/nana-theme";
import { upsertUserProfile } from "../data/time-tracking-repository";
import { useTimeTracker } from "../model/use-time-tracker";

type Tab = "today" | "calendar" | "bank" | "history" | "profile";

type EditTarget =
  | { kind: "time"; entry: TimeEntry }
  | { kind: "break"; entry: BreakEntry };

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
  return isoDate.slice(0, 10);
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

export function NanaPointApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(() => hasSupabaseConfig());
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
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
              <CalendarView tracker={tracker} onEdit={setEditTarget} />
            )}
            {tab === "bank" && <HourBankView tracker={tracker} />}
            {tab === "history" && (
              <HistoryView tracker={tracker} onEdit={setEditTarget} />
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
  onEdit,
}: {
  tracker: ReturnType<typeof useTimeTracker>;
  onEdit: (target: EditTarget) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const colors = {
    today: nanaColors.orange,
    complete: nanaColors.green,
    exceeded: "#43a047",
    negative: "#fb8c00",
    pending: "#ef6c00",
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
              <Box
                component={motion.button}
                type="button"
                key={day.date}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
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
                  bgcolor: day.status === "empty" ? "#fffaf3" : "#ffffff",
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
            onEdit={onEdit}
            onAfterEdit={closeDay}
          />
        )}
      </Popover>
      <Legend />
    </Stack>
  );
}

function DayPopoverContent({
  day,
  onEdit,
  onAfterEdit,
}: {
  day: ReturnType<typeof useTimeTracker>["calendarDays"][number];
  onEdit: (target: EditTarget) => void;
  onAfterEdit: () => void;
}) {
  const hasRecords = day.entries.length > 0 || day.breaks.length > 0;
  const balanceLabel =
    day.balanceMinutes === 0
      ? "0min"
      : minutesToHoursLabel(day.balanceMinutes);
  const statusColor =
    day.status === "empty"
      ? nanaColors.muted
      : day.status === "negative" || day.status === "pending"
        ? "#b45309"
        : nanaColors.green;

  function edit(target: EditTarget) {
    onEdit(target);
    onAfterEdit();
  }

  return (
    <Box sx={{ bgcolor: "#ffffff" }}>
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

      <Stack spacing={1.6} sx={{ p: 2 }}>
        <Box
          sx={{
            border: `2px solid ${nanaColors.orange}`,
            borderRadius: "10px",
            p: 1.25,
            bgcolor: "#fffdf9",
            boxShadow: "0 8px 20px rgba(245, 124, 0, 0.08)",
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
              bgcolor: nanaColors.orangeSoft,
              color: nanaColors.orange,
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
              {statusLabels[day.dayStatus]}
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
            label={hasRecords ? `${day.entries.length + day.breaks.length} itens` : "vazio"}
            size="small"
            sx={{
              borderRadius: "6px",
              bgcolor: hasRecords ? nanaColors.greenSoft : "#f3f0ea",
              color: hasRecords ? nanaColors.green : nanaColors.muted,
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
          <PopoverMetric label="Status" value={statusLabels[day.dayStatus]} color={statusColor} />
          <PopoverMetric label="Jornada" value={minutesToHoursLabel(day.workedMinutes)} color={nanaColors.green} />
          <PopoverMetric
            label="Saldo"
            value={balanceLabel}
            color={day.balanceMinutes < 0 ? nanaColors.orange : nanaColors.green}
          />
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
                label={`${day.entries.length + day.breaks.length} registros`}
                size="small"
                sx={{
                  bgcolor: nanaColors.greenSoft,
                  color: nanaColors.green,
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
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Box
      sx={{
        minHeight: 70,
        borderRadius: "8px",
        border: `1px solid ${nanaColors.line}`,
        bgcolor: "#fffdf9",
        px: 1.25,
        py: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
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
  const records = [
    ...entries.map((entry) => ({
      id: `time-${entry.id}`,
      at: entry.occurredAt,
      time: formatTimePtBr(entry.occurredAt),
      label: actionLabels[entry.type],
      caption: entry.note,
      isModified: entry.isModified,
      tone: nanaColors.green,
      onEdit: () => onEdit({ kind: "time", entry }),
    })),
    ...breaks.map((entry) => ({
      id: `break-${entry.id}`,
      at: entry.startsAt,
      time: `${formatTimePtBr(entry.startsAt)}-${entry.endsAt ? formatTimePtBr(entry.endsAt) : "aberta"}`,
      label: breakLabels[entry.category],
      caption: entry.note,
      isModified: entry.isModified,
      tone: nanaColors.orange,
      onEdit: () => onEdit({ kind: "break", entry }),
    })),
  ].sort((first, second) => first.at.localeCompare(second.at));

  if (records.length === 0) return null;

  return (
    <Stack spacing={1.1}>
      {records.map((record) => (
        <Box
          key={record.id}
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
              bgcolor: `${record.tone}16`,
              color: record.tone,
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
              bgcolor: nanaColors.orangeSoft,
              minWidth: 0,
              px: 1.1,
              "&:hover": { bgcolor: "#ffe0b2" },
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
      <SectionTitle title="Banco de horas" subtitle="Créditos, débitos e compensações" />
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
            Calculado somente a partir dos movimentos salvos no banco.
          </Typography>
        </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          Nenhum movimento de banco de horas foi lançado ainda.
        </Alert>
      )}
      <Stack spacing={1.5}>
        {tracker.movements.map((movement) => (
          <Card key={movement.id}>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{movement.description}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDatePtBr(movement.date)}
                  </Typography>
                </Box>
                <Chip
                  label={minutesToHoursLabel(movement.minutesDelta)}
                  color={movement.minutesDelta >= 0 ? "secondary" : "warning"}
                />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function HistoryView({
  tracker,
  onEdit,
}: {
  tracker: ReturnType<typeof useTimeTracker>;
  onEdit: (target: EditTarget) => void;
}) {
  const workedThisMonth = tracker.dailySummaries.reduce(
    (total, day) => total + day.workedMinutes,
    0,
  );
  const registeredDays = tracker.dailySummaries.filter((day) => day.entries.length > 0);
  const monthLabel = registeredDays.length > 0
    ? minutesToHoursLabel(workedThisMonth)
    : "Sem registros";
  const pausesLabel = tracker.breaks.length > 0
    ? String(tracker.breaks.length)
    : "Sem pausas";

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
      {registeredDays.length === 0 && (
        <Alert severity="info">Nenhum registro salvo neste mês ainda.</Alert>
      )}
      {registeredDays.map((day) => (
        <Card key={day.date}>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>{formatDatePtBr(day.date)}</Typography>
                <Typography color="text.secondary">
                  {formatWeekdayLongPtBr(day.date)} · {statusLabels[day.status]}
                </Typography>
              </Box>
              <Chip label={minutesToHoursLabel(day.workedMinutes)} color="secondary" />
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            <RecordMiniList
              entries={day.entries}
              breaks={day.breaks}
              onEdit={onEdit}
            />
          </CardContent>
        </Card>
      ))}
    </Stack>
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
