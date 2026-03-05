// ============================================================
// EVENTMIND - Servidor Express (API REST para el frontend)
// Expone el agente como endpoint POST /api/chat
// ============================================================

import fs from "fs";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// Servir el frontend estático desde la misma carpeta
app.use(express.static(__dirname));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/* =====================================================
   RUTAS DE ARCHIVOS DE PERSISTENCIA
===================================================== */
const historyPath = "./chat_history.json";
const recursosPath = "./recursos.json";
const eventosPath = "./eventos.json";

/* =====================================================
   FUNCIONES AUXILIARES DE ARCHIVOS
===================================================== */
function loadJSON(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) return defaultValue;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadInitialStateFromJSON() {
  return {
    history: loadJSON(historyPath, {
      messages: [],
      params: { temperature: 0.3 },
      total_tokens_acumulados: 0
    }),
    recursos: loadJSON(recursosPath, []),
    eventos: loadJSON(eventosPath, [])
  };
}

function normalizeState(rawState) {
  const defaults = loadInitialStateFromJSON();
  const state = rawState || {};

  return {
    history: {
      messages: Array.isArray(state.history?.messages) ? state.history.messages : defaults.history.messages,
      params: {
        temperature: Number.isFinite(state.history?.params?.temperature)
          ? state.history.params.temperature
          : defaults.history.params.temperature
      },
      total_tokens_acumulados: Number.isFinite(state.history?.total_tokens_acumulados)
        ? state.history.total_tokens_acumulados
        : defaults.history.total_tokens_acumulados
    },
    recursos: Array.isArray(state.recursos) ? state.recursos : defaults.recursos,
    eventos: Array.isArray(state.eventos) ? state.eventos : defaults.eventos
  };
}

function buildStats(state) {
  return {
    total_tokens: state.history.total_tokens_acumulados || 0,
    total_mensajes: state.history.messages.length,
    total_eventos: state.eventos.length,
    total_recursos: state.recursos.length
  };
}

function defaultHistory() {
  return {
    messages: [],
    params: { temperature: 0.3 },
    total_tokens_acumulados: 0
  };
}

/* =====================================================
   DEFINICIÓN DE HERRAMIENTAS
===================================================== */
const herramientasEventMind = {
  functionDeclarations: [
    {
      name: "registrarRecurso",
      description: "Registra un nuevo recurso logístico disponible para eventos.",
      parameters: {
        type: "OBJECT",
        properties: {
          nombre: { type: "STRING" },
          tipo: { type: "STRING" },
          cantidad: { type: "NUMBER" },
          costo_unitario: { type: "NUMBER" }
        },
        required: ["nombre", "tipo", "cantidad", "costo_unitario"]
      }
    },
    {
      name: "registrarEvento",
      description: "Registra un nuevo evento en el sistema.",
      parameters: {
        type: "OBJECT",
        properties: {
          nombre: { type: "STRING" },
          tipo: { type: "STRING" },
          asistentes: { type: "NUMBER" },
          duracion_horas: { type: "NUMBER" },
          ubicacion: { type: "STRING" }
        },
        required: ["nombre", "tipo", "asistentes", "duracion_horas", "ubicacion"]
      }
    },
    {
      name: "asignarRecursoEvento",
      description: "Asigna un recurso existente a un evento específico.",
      parameters: {
        type: "OBJECT",
        properties: {
          evento: { type: "STRING" },
          recurso: { type: "STRING" },
          cantidad: { type: "NUMBER" }
        },
        required: ["evento", "recurso", "cantidad"]
      }
    },
    {
      name: "calcularCostoEvento",
      description: "Calcula el costo total del evento según recursos asignados.",
      parameters: {
        type: "OBJECT",
        properties: { evento: { type: "STRING" } },
        required: ["evento"]
      }
    },
    {
      name: "analizarRiesgoLogistico",
      description: "Analiza el nivel de riesgo logístico del evento.",
      parameters: {
        type: "OBJECT",
        properties: { evento: { type: "STRING" } },
        required: ["evento"]
      }
    },
    {
      name: "generarProyeccionFinanciera",
      description: "Genera proyección financiera básica del evento.",
      parameters: {
        type: "OBJECT",
        properties: {
          evento: { type: "STRING" },
          precio_entrada: { type: "NUMBER" }
        },
        required: ["evento", "precio_entrada"]
      }
    },
    {
      name: "listarEventos",
      description: "Lista todos los eventos registrados en el sistema.",
      parameters: { type: "OBJECT", properties: {} }
    },
    {
      name: "listarRecursos",
      description: "Lista todos los recursos disponibles en el sistema.",
      parameters: { type: "OBJECT", properties: {} }
    }
  ]
};

/* =====================================================
   IMPLEMENTACIÓN DE LAS HERRAMIENTAS
===================================================== */
const executableTools = {
  registrarRecurso: (args, state) => {
    state.recursos.push({ ...args });
    return { status: "success", message: "Recurso registrado correctamente." };
  },

  registrarEvento: (args, state) => {
    state.eventos.push({ ...args, recursos_asignados: [] });
    return { status: "success", message: "Evento registrado correctamente." };
  },

  asignarRecursoEvento: (args, state) => {
    const evento = state.eventos.find(e => e.nombre === args.evento);
    const recurso = state.recursos.find(r => r.nombre === args.recurso);
    if (!evento || !recurso) return { status: "error", message: "Evento o recurso no encontrado." };
    if (recurso.cantidad < args.cantidad) return { status: "error", message: "Cantidad insuficiente de recurso." };
    recurso.cantidad -= args.cantidad;
    evento.recursos_asignados.push({ nombre: recurso.nombre, cantidad: args.cantidad, costo_unitario: recurso.costo_unitario });
    return { status: "success", message: "Recurso asignado correctamente." };
  },

  calcularCostoEvento: (args, state) => {
    const evento = state.eventos.find(e => e.nombre === args.evento);
    if (!evento) return { status: "error", message: "Evento no encontrado." };
    let total = 0;
    evento.recursos_asignados.forEach(r => { total += r.cantidad * r.costo_unitario; });
    return { status: "success", costo_total: total };
  },

  analizarRiesgoLogistico: (args, state) => {
    const evento = state.eventos.find(e => e.nombre === args.evento);
    if (!evento) return { status: "error", message: "Evento no encontrado." };
    let riesgo = 0;
    if (evento.ubicacion.toLowerCase() === "exterior") riesgo += 20;
    if (evento.asistentes > 1000) riesgo += 30;
    if (evento.duracion_horas > 8) riesgo += 20;
    let nivel = "bajo";
    if (riesgo >= 50) nivel = "alto";
    else if (riesgo >= 25) nivel = "medio";
    return { status: "success", nivel_riesgo: nivel, porcentaje_riesgo: riesgo };
  },

  generarProyeccionFinanciera: (args, state) => {
    const evento = state.eventos.find(e => e.nombre === args.evento);
    if (!evento) return { status: "error", message: "Evento no encontrado." };
    let costo_total = 0;
    evento.recursos_asignados.forEach(r => { costo_total += r.cantidad * r.costo_unitario; });
    const ingresos = evento.asistentes * args.precio_entrada;
    const margen = ingresos - costo_total;
    return { status: "success", costo_total, ingresos_estimados: ingresos, margen_proyectado: margen };
  },

  listarEventos: (_, state) => {
    if (state.eventos.length === 0) return { status: "success", message: "No hay eventos registrados." };
    return { status: "success", total_eventos: state.eventos.length, eventos: state.eventos };
  },

  listarRecursos: (_, state) => {
    if (state.recursos.length === 0) return { status: "success", message: "No hay recursos registrados." };
    return { status: "success", total_recursos: state.recursos.length, recursos: state.recursos };
  }
};

/* =====================================================
   MODELO GEMINI
===================================================== */
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  tools: [herramientasEventMind],
  systemInstruction: `Eres EventMind, un asistente experto en planificación y análisis operativo de eventos en vivo (conciertos, festivales, eventos corporativos).
Tu rol es ayudar a productores y organizadores a registrar recursos, crear eventos, calcular costos, analizar riesgos y proyectar viabilidad financiera.
Cuando el usuario pida acciones concretas, SIEMPRE usa las herramientas disponibles. No inventes datos.
Responde siempre en español, de forma clara y profesional. Tras ejecutar una herramienta, interpreta el resultado y explícaselo al usuario de forma amigable.`
});

/* =====================================================
   HISTORIAL
===================================================== */
app.post("/api/chat", async (req, res) => {
  const { message, state: incomingState } = req.body;
  if (!message) return res.status(400).json({ error: "Mensaje requerido." });

  const state = normalizeState(incomingState);
  const data = state.history || defaultHistory();
  let totalEntrada = 0;
  let totalSalida = 0;

  const formattedHistory = data.messages.map(m => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const chatSession = model.startChat({
    history: formattedHistory,
    generationConfig: { temperature: data.params.temperature }
  });

  try {
    const result = await chatSession.sendMessage(message);
    totalEntrada += result.response.usageMetadata?.promptTokenCount || 0;
    totalSalida += result.response.usageMetadata?.candidatesTokenCount || 0;

    const response = result.response;
    const call = response.candidates[0].content.parts.find(p => p.functionCall);

    let finalResponseText = "";
    let toolUsed = null;

    if (call) {
      const { name, args } = call.functionCall;
      toolUsed = name;
      const toolHandler = executableTools[name];

      if (!toolHandler) {
        return res.status(400).json({ error: `Herramienta no implementada: ${name}` });
      }

      const toolResult = toolHandler(args, state);

      const secondResponse = await chatSession.sendMessage([{
        functionResponse: { name, response: toolResult }
      }]);

      totalEntrada += secondResponse.response.usageMetadata?.promptTokenCount || 0;
      totalSalida += secondResponse.response.usageMetadata?.candidatesTokenCount || 0;
      finalResponseText = secondResponse.response.text();
    } else {
      finalResponseText = response.text();
    }

    data.messages.push({ role: "user", content: message });
    data.messages.push({ role: "model", content: finalResponseText });
    data.total_tokens_acumulados = (data.total_tokens_acumulados || 0) + totalEntrada + totalSalida;
    state.history = data;

    res.json({
      reply: finalResponseText,
      tokens: { entrada: totalEntrada, salida: totalSalida },
      toolUsed,
      state,
      stats: buildStats(state)
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Error procesando la solicitud." });
  }
});

app.get("/api/bootstrap", (req, res) => {
  const state = normalizeState(loadInitialStateFromJSON());
  res.json({ state, stats: buildStats(state) });
});

/* =====================================================
   ARRANQUE
===================================================== */
export default app;
