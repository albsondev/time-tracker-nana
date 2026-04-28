"use client";

import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  formatDatePtBr,
  formatMonthPtBr,
  minutesToDecimalHours,
  minutesToHoursLabel,
} from "@/domain/time/format";
import type { BreakCategory, TimeEntry } from "@/domain/time/types";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { fadeUp, springy, staggerContainer } from "@/shared/motion/presets";
import { nanaColors } from "@/shared/theme/nana-theme";
import { useTimeTracker } from "../model/use-time-tracker";

type Tab = "today" | "calendar" | "bank" | "history" | "profile";

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

export function NanaPointApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(() => hasSupabaseConfig());
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const supabase = hasSupabaseConfig() ? getSupabaseBrowserClient() : null;
  const tracker = useTimeTracker({
    supabase,
    userId: session?.user.id ?? null,
  });

  const transition = shouldReduceMotion ? { duration: 0 } : springy;

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      return;
    }

    const client = getSupabaseBrowserClient();

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    return <LoginScreen />;
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at top left, rgba(245, 124, 0, 0.18), transparent 32rem), linear-gradient(180deg, #fffaf3 0%, #f5fbf2 100%)",
        pb: 11,
      }}
    >
      <Container maxWidth="sm" sx={{ px: 2, py: 2.5 }}>
        <AppHeader bankBalance={tracker.hourBankBalance} />

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
            {tab === "calendar" && <CalendarView tracker={tracker} />}
            {tab === "bank" && <HourBankView tracker={tracker} />}
            {tab === "history" && <HistoryView tracker={tracker} />}
            {tab === "profile" && <ProfileView session={session} onLogout={logout} />}
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

function LoginScreen() {
  async function login(provider: "google" | "apple") {
    if (!hasSupabaseConfig()) return;

    await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
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
            <Stack spacing={1.5}>
              <Button
                size="large"
                variant="contained"
                disabled={!hasSupabaseConfig()}
                onClick={() => login("google")}
              >
                Entrar com Google
              </Button>
              <Button
                size="large"
                variant="outlined"
                disabled={!hasSupabaseConfig()}
                onClick={() => login("apple")}
              >
                Entrar com Apple
              </Button>
            </Stack>
            {!hasSupabaseConfig() && (
              <Alert severity="warning">
                O acesso ainda não está disponível. Tente novamente mais tarde.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </MotionCard>
    </Box>
  );
}

function AppHeader({ bankBalance }: { bankBalance: number }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          Nana&apos;s Point
        </Typography>
        <Typography variant="h5">Olá, Nana</Typography>
      </Box>
      <Chip
        icon={<SavingsRoundedIcon />}
        label={minutesToHoursLabel(bankBalance)}
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
                {minutesToHoursLabel(summary.breakMinutes)} em pausas registradas hoje.
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
            ["Semana", minutesToHoursLabel(tracker.weekSummary.workedMinutes), "Meta: 30h"],
            ["Saldo semanal", minutesToHoursLabel(tracker.weekSummary.balanceMinutes), "Crédito/débito"],
            ["Banco", minutesToHoursLabel(tracker.hourBankBalance), "Saldo acumulado"],
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

function CalendarView({ tracker }: { tracker: ReturnType<typeof useTimeTracker> }) {
  const colors = {
    today: nanaColors.orange,
    complete: nanaColors.green,
    exceeded: "#43a047",
    negative: "#fb8c00",
    pending: "#ef6c00",
    empty: "#d8d1c6",
  };

  return (
    <Stack spacing={2}>
      <SectionTitle title="Calendário" subtitle={formatMonthPtBr(tracker.today)} />
      <Card>
        <CardContent>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
            {tracker.calendarDays.map((day, index) => (
              <Box
                component={motion.div}
                key={day.date}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.012 }}
                sx={{
                  aspectRatio: "1",
                  borderRadius: 3,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: day.status === "empty" ? "#fffaf3" : "#ffffff",
                  border: `2px solid ${colors[day.status]}`,
                  color: day.status === "empty" ? "text.secondary" : "text.primary",
                  position: "relative",
                  fontWeight: 800,
                }}
              >
                {day.day}
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
      <Legend />
    </Stack>
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

function HourBankView({ tracker }: { tracker: ReturnType<typeof useTimeTracker> }) {
  return (
    <Stack spacing={2}>
      <SectionTitle title="Banco de horas" subtitle="Créditos, débitos e compensações" />
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
            Inclui os movimentos salvos e a diferença da semana atual.
          </Typography>
        </CardContent>
      </Card>
      <Stack spacing={1.5}>
        {tracker.movements.length === 0 && (
          <Alert severity="info">Nenhum movimento de banco de horas salvo ainda.</Alert>
        )}
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

function HistoryView({ tracker }: { tracker: ReturnType<typeof useTimeTracker> }) {
  const workedThisMonth = tracker.dailySummaries.reduce(
    (total, day) => total + day.workedMinutes,
    0,
  );
  const registeredDays = tracker.dailySummaries.filter((day) => day.entries.length > 0);

  return (
    <Stack spacing={2}>
      <SectionTitle title="Histórico" subtitle="Resumo mensal e rastreabilidade" />
      <SummaryGrid
        items={[
          ["Mês", minutesToHoursLabel(workedThisMonth), "Horas trabalhadas"],
          ["Semana", minutesToHoursLabel(tracker.weekSummary.balanceMinutes), "Saldo atual"],
          ["Pausas", String(tracker.breaks.length), "Registradas"],
        ]}
      />
      {registeredDays.length === 0 && (
        <Alert severity="info">Nenhum registro salvo neste mês ainda.</Alert>
      )}
      {registeredDays.map((day) => (
        <Card key={day.date}>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>{formatDatePtBr(day.date)}</Typography>
                <Typography color="text.secondary">{statusLabels[day.status]}</Typography>
              </Box>
              <Chip label={minutesToHoursLabel(day.workedMinutes)} color="secondary" />
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function ProfileView({
  session,
  onLogout,
}: {
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
              Meta semanal fixa: <strong>30 horas</strong>.
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
      sx={{ top: "auto", bottom: 0, p: 1.5, backdropFilter: "blur(18px)" }}
    >
      <BottomNavigation
        value={tab}
        onChange={(_, next) => onChange(next)}
        showLabels
        sx={{
          maxWidth: 520,
          mx: "auto",
          borderRadius: 999,
          border: `1px solid ${nanaColors.line}`,
          boxShadow: "0 16px 40px rgba(64, 42, 12, 0.14)",
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
