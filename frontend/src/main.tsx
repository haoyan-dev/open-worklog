import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import "@mantine/core/styles.css";
import "@mantine/tiptap/styles.css";
import "@mantine/dates/styles.css";

import App from "./App";
import "./styles.css";

const queryClient = new QueryClient();

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <MantineProvider>
      <DatesProvider settings={{ firstDayOfWeek: 1 }}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  </React.StrictMode>
);
