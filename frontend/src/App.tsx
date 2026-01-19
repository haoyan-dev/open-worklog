import { useState } from "react";
import { AppShell, Group, NavLink, Stack, Text } from "@mantine/core";

import DayView from "./views/DayView";
import WeekView from "./views/WeekView";

type ViewMode = "day" | "week";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("day");

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: "sm" }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={600}>Open Worklog</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <NavLink
            label="Day View"
            active={viewMode === "day"}
            component="button"
            type="button"
            onClick={() => setViewMode("day")}
          />
          <NavLink
            label="Week View"
            active={viewMode === "week"}
            component="button"
            type="button"
            onClick={() => setViewMode("week")}
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        {viewMode === "day" ? <DayView /> : <WeekView />}
      </AppShell.Main>
    </AppShell>
  );
}
