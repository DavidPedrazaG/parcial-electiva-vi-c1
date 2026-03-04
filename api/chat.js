import fs from "fs";
import dotenv from "dotenv";
import readline from "readline";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

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

// Cargar JSON genérico
function loadJSON(path, defaultValue) {
  if (!fs.existsSync(path)) return defaultValue;
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

// Guardar JSON genérico
function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

/* =====================================================
   DEFINICIÓN DE HERRAMIENTAS (6 FUNCIONALES)
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
        properties: {
          evento: { type: "STRING" }
        },
        required: ["evento"]
      }
    },
    {
      name: "analizarRiesgoLogistico",
      description: "Analiza el nivel de riesgo logístico del evento.",
      parameters: {
        type: "OBJECT",
        properties: {
          evento: { type: "STRING" }
        },
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
      parameters: {
        type: "OBJECT",
        properties: {},
     }
    },
    {
      name: "listarRecursos",
      description: "Lista todos los recursos disponibles en el sistema.",
      parameters: {
        type: "OBJECT",
        properties: {},
      }
    }
  ]
};

/* =====================================================
   IMPLEMENTACIÓN REAL DE LAS HERRAMIENTAS
===================================================== */

const executableTools = {

  // 1️⃣ Registrar recurso
  registrarRecurso: (args) => {
    const recursos = loadJSON(recursosPath, []);
    recursos.push({ ...args });
    saveJSON(recursosPath, recursos);

    return { status: "success", message: "Recurso registrado correctamente." };
  },

  // 2️⃣ Registrar evento
  registrarEvento: (args) => {
    const eventos = loadJSON(eventosPath, []);
    eventos.push({ ...args, recursos_asignados: [] });
    saveJSON(eventosPath, eventos);

    return { status: "success", message: "Evento registrado correctamente." };
  },

  // 3️⃣ Asignar recurso a evento
  asignarRecursoEvento: (args) => {
    const eventos = loadJSON(eventosPath, []);
    const recursos = loadJSON(recursosPath, []);

    const evento = eventos.find(e => e.nombre === args.evento);
    const recurso = recursos.find(r => r.nombre === args.recurso);

    if (!evento || !recurso) {
      return { status: "error", message: "Evento o recurso no encontrado." };
    }

    if (recurso.cantidad < args.cantidad) {
      return { status: "error", message: "Cantidad insuficiente de recurso." };
    }

    recurso.cantidad -= args.cantidad;

    evento.recursos_asignados.push({
      nombre: recurso.nombre,
      cantidad: args.cantidad,
      costo_unitario: recurso.costo_unitario
    });

    saveJSON(eventosPath, eventos);
    saveJSON(recursosPath, recursos);

    return { status: "success", message: "Recurso asignado correctamente." };
  },

  // 4️⃣ Calcular costo total
  calcularCostoEvento: (args) => {
    const eventos = loadJSON(eventosPath, []);
    const evento = eventos.find(e => e.nombre === args.evento);

    if (!evento) return { status: "error", message: "Evento no encontrado." };

    let total = 0;

    evento.recursos_asignados.forEach(r => {
      total += r.cantidad * r.costo_unitario;
    });

    return { status: "success", costo_total: total };
  },

  // 5️⃣ Analizar riesgo logístico
  analizarRiesgoLogistico: (args) => {
    const eventos = loadJSON(eventosPath, []);
    const evento = eventos.find(e => e.nombre === args.evento);

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

  // 6️⃣ Proyección financiera
  generarProyeccionFinanciera: (args) => {
    const eventos = loadJSON(eventosPath, []);
    const evento = eventos.find(e => e.nombre === args.evento);

    if (!evento) return { status: "error", message: "Evento no encontrado." };

    let costo_total = 0;
    evento.recursos_asignados.forEach(r => {
      costo_total += r.cantidad * r.costo_unitario;
    });

    const ingresos = evento.asistentes * args.precio_entrada;
    const margen = ingresos - costo_total;

    return {
      status: "success",
      costo_total,
      ingresos_estimados: ingresos,
      margen_proyectado: margen
    };
  },

    // 7️⃣ Listar eventos registrados
    listarEventos: () => {
    const eventos = loadJSON(eventosPath, []);

    if (eventos.length === 0) {
        return { status: "success", message: "No hay eventos registrados." };
    }

    return {
        status: "success",
        total_eventos: eventos.length,
        eventos: eventos
    };
    },

    // 8️⃣ Listar recursos disponibles
    listarRecursos: () => {
    const recursos = loadJSON(recursosPath, []);

    if (recursos.length === 0) {
        return { status: "success", message: "No hay recursos registrados." };
    }

    return {
        status: "success",
        total_recursos: recursos.length,
        recursos: recursos
    };
    }
};

/* =====================================================
   CONFIGURACIÓN DEL MODELO
===================================================== */

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  tools: [herramientasEventMind]
});

/* =====================================================
   HISTORIAL DE CHAT (igual que el profe)
===================================================== */

function loadHistory() {
  return loadJSON(historyPath, {
    messages: [],
    params: { temperature: 0.3 },
    total_tokens_acumulados: 0
  });
}

function saveHistory(data) {
  saveJSON(historyPath, data);
}

/* =====================================================
   LÓGICA PRINCIPAL DE CHAT (MISMA DEL PROFE)
===================================================== */

async function chat(userMessage) {
  const data = loadHistory();

  const formattedHistory = data.messages.map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const chatSession = model.startChat({
    history: formattedHistory,
    generationConfig: {
      temperature: data.params.temperature,
    }
  });

  try {
    const result = await chatSession.sendMessage(userMessage);
    const response = result.response;

    const call = response.candidates[0].content.parts.find(p => p.functionCall);

    let finalResponseText = "";

    if (call) {
      const { name, args } = call.functionCall;
      const toolResult = executableTools[name](args);

      const secondResponse = await chatSession.sendMessage([{
        functionResponse: {
          name,
          response: toolResult
        }
      }]);

      finalResponseText = secondResponse.response.text();
    } else {
      finalResponseText = response.text();
    }

    data.messages.push({ role: "user", content: userMessage });
    data.messages.push({ role: "model", content: finalResponseText });

    saveHistory(data);

    return finalResponseText;

  } catch (error) {
    console.error("Error:", error);
    return "Error procesando la solicitud.";
  }
}

/* =====================================================
   INTERFAZ TERMINAL
===================================================== */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function bucleChat() {
  rl.question("\n👤 Tú: ", async (input) => {
    if (input.toLowerCase() === "salir") {
      rl.close();
      return;
    }

    const respuesta = await chat(input);
    console.log("🤖 EventMind:", respuesta);
    bucleChat();
  });
}

console.log("🎪 --- EVENTMIND: AGENTE DE PRODUCCIÓN DE EVENTOS ---");
bucleChat();