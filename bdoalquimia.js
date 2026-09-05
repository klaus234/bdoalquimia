/*
    BDO - Calculadora de Alquimia
    Hermana de bdococina. Diferencia principal: una receta no siempre se hace
    con "Alquimia"; algunos ingredientes sólo salen de Procesamiento
    (Alquimia Simple, Calentar, Secar, Moler, Filtrar, Sacudir...), y cada
    forma de elaboración rinde distinto.

    TODO:
    - Cajas de Alquimia Imperial (cantidades por caja).
    - Guardar recetas favoritas.
*/

console.log("v 1.0.0");
let rdata;
let inglist = [];

const calidad_ing = [1, 3, 5];

let gpeso = 0;

const baseurl = window.location.href;

let modoseleccion = false;
let anteriorseleccion = -1;
let selectactual_recetas = -1;
let lista_recetas_ul;
let currentingrediente;
let calidades = {
    "normal": 0,
    "verde": 1,
    "azul": 2
}

/* -----------------------------------------------------------------
   Tipos de elaboración
   -----------------------------------------------------------------
   grupo "alquimia" -> usa el ratio de Alquimia (rinde 1~4 con maestría)
   grupo "simple"   -> Alquimia Simple: rinde SIEMPRE x1, no hay bono
   grupo "proc"     -> Procesamiento: usa el ratio de Procesamiento
   ----------------------------------------------------------------- */
const TIPOS = {
    "alquimia": { label: "Alquimia", clase: "t_alquimia", grupo: "alquimia" },
    "simple": { label: "Alquimia Simple", clase: "t_simple", grupo: "simple" },
    "calentar": { label: "Calentar", clase: "t_proc", grupo: "proc" },
    "secar": { label: "Secar", clase: "t_proc", grupo: "proc" },
    "moler": { label: "Moler", clase: "t_proc", grupo: "proc" },
    "filtrar": { label: "Filtrar", clase: "t_proc", grupo: "proc" },
    "sacudir": { label: "Sacudir", clase: "t_proc", grupo: "proc" },
    "cortar": { label: "Cortar", clase: "t_proc", grupo: "proc" }
};

const AYUDA_TIPO = {
    "alquimia": "Se elabora con Alquimia (mesa de alquimia). El ratio depende de tu maestría.",
    "simple": "Se elabora con Procesamiento → Alquimia Simple. Rinde siempre x1: no hay bono por maestría.",
    "proc": "Se obtiene con Procesamiento. Abajo se lista qué ítems hay que procesar y cuántos."
};

const VERBO_TIPO = {
    "alquimia": "Cantidad elaborada: ",
    "simple": "Cantidad de mezclas: ",
    "proc": "Veces procesadas: "
};

function esReceta(id) {
    return rdata["recetas"][id] != undefined;
}

function ingredientesDe(id) {
    return rdata["recetas"][id]["ing"];
}

function tipoDe(id) {
    const t = rdata["recetas"][id]["tipo"];
    return TIPOS[t] != undefined ? t : "alquimia";
}

function grupoDe(id) {
    return TIPOS[tipoDe(id)].grupo;
}

/* Ratio de rendimiento según cómo se elabora la receta. */
function obtenerRatio(grupo) {
    if (grupo == "simple")
        return 1;
    const inp = document.getElementById(grupo == "proc" ? "ratio_proc" : "ratio");
    if (inp == null)
        return 1;
    const r = parseFloat(inp.value);
    if (!isFinite(r) || r <= 0)
        return 1;
    return r;
}

function ratioDeReceta(id) {
    return obtenerRatio(grupoDe(id));
}

function crearBadgeTipo(id) {
    const t = TIPOS[tipoDe(id)];
    const b = document.createElement("span");
    b.className = "badge_tipo " + t.clase;
    b.innerText = t.label;
    return b;
}

/* -----------------------------------------------------------------
   Grupos de materiales
   -----------------------------------------------------------------
   Un ingrediente con `grupo` acepta cualquier ítem de su grupo. Los que
   además traen `miembros` (sólo los ingredientes base) pueden desplegar la
   lista con la cantidad equivalente de cada sustituto.

   El "valor" de un miembro es cuántas unidades básicas reemplaza, así que
   para cubrir `cantidad` del ítem mostrado hacen falta:
       cantidad * valor(del ítem mostrado) / valor(del sustituto)
   ----------------------------------------------------------------- */

function tieneMiembros(clave) {
    const d = rdata["datos"][clave];
    return d["miembros"] != undefined && d["miembros"].length > 0;
}

function crearMarcaGrupo(clave) {
    const m = document.createElement("span");
    m.className = "marca_grupo";
    m.innerText = "↻";
    if (clave != undefined && tieneMiembros(clave)) {
        m.classList.add("desplegable");
        m.title = "Ver los " + rdata["datos"][clave]["miembros"].length + " ítems de su grupo";
    } else {
        m.title = "Sustituible por cualquier ítem de su grupo";
    }
    return m;
}

/* Cuántas unidades de un sustituto hacen falta en total.
   La sustitución se resuelve POR ELABORACIÓN: en el juego cada craft consume
   sus propios ingredientes y lo que sobra del ítem de mayor valor se pierde,
   no queda para el siguiente. Si la receta pide 5 Flor Escama de Fuego y una
   de Alta Calidad vale 36, esa flor cubre ese craft entero y nada más: para
   100 elaboraciones hacen falta 100 flores, no 100*5/36. */
function unidadesSustituto(usos, vPropio, vMiembro) {
    let total = 0;
    for (let u of usos) {
        const porElaboracion = Math.ceil((u["q"] * vPropio) / vMiembro);
        total += u["veces"] * porElaboracion;
    }
    return Math.ceil(total);
}

function llenarPanelGrupo(panel) {
    const clave = panel.bdoclave;
    const datos = rdata["datos"][clave];
    const miembros = datos["miembros"];
    const usos = panel.bdousos() || [];
    const propio = miembros.find(function (m) { return m["propio"]; }) || { "v": 1 };

    panel.innerHTML = "";

    const tit = document.createElement("div");
    tit.className = "panel_grupo_tit";
    tit.innerText = "Grupo #" + datos["gid"] + " · sirve cualquiera de estos";
    panel.append(tit);

    const ul = document.createElement("ul");
    for (let m of miembros) {
        const li = document.createElement("li");
        if (m["propio"])
            li.className = "propio";

        const nom = document.createElement("span");
        nom.className = "mg_nombre";
        nom.innerText = m["t"];

        const cant = document.createElement("span");
        cant.className = "mg_cant";
        cant.innerText = "x" + formatearMilesAR(unidadesSustituto(usos, propio["v"], m["v"]));
        cant.title = m["v"] > propio["v"]
            ? "Vale " + m["v"] + ": cubre una elaboración entera y lo que sobra se pierde"
            : "Vale " + m["v"];

        li.append(nom);
        li.append(cant);
        ul.append(li);
    }
    panel.append(ul);

    const nota = document.createElement("div");
    nota.className = "panel_grupo_nota";
    nota.innerText = "Se gasta por elaboración: lo que sobra de un ítem de mayor valor no pasa a la siguiente.";
    panel.append(nota);
}

/* Cuelga la marca ↻ de `dondeMarca` y, si hay miembros, el panel desplegable
   de `dondePanel`. `obtenerUsos` devuelve [{q, veces}, ...] y se evalúa cada
   vez que se refresca el panel. */
function montarGrupo(dondeMarca, dondePanel, clave, obtenerUsos) {
    if (!rdata["datos"][clave]["grupo"])
        return;

    const marca = crearMarcaGrupo(clave);
    dondeMarca.append(marca);

    if (!tieneMiembros(clave))
        return;

    const panel = document.createElement("div");
    panel.className = "panel_grupo oculto";
    panel.bdoclave = clave;
    panel.bdousos = obtenerUsos;
    dondePanel.append(panel);

    marca.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        const abierto = !panel.classList.contains("oculto");
        if (abierto) {
            panel.classList.add("oculto");
            marca.classList.remove("abierta");
        } else {
            llenarPanelGrupo(panel);
            panel.classList.remove("oculto");
            marca.classList.add("abierta");
        }
    });
}

/* Los paneles abiertos de la lista principal siguen a los inputs de cantidad. */
function refrescarPanelesGrupo() {
    document.querySelectorAll("#ingredientes .panel_grupo").forEach(function (p) {
        if (!p.classList.contains("oculto"))
            llenarPanelGrupo(p);
    });
}

/* La lista de ingredientes base tiene dos vistas: el árbol anidado y la lista
   plana de ingredientes puros (los que no salen ni de alquimia ni de
   procesamiento: se compran o se recolectan). */
let vistaBaseActual = "arbol";

/* Métodos verificados por ingrediente; el precio del Codex no implica venta NPC. */
const OBTENCION = {
    recoleccion: { icono: "⛏", label: "Recolección" },
    npc: { icono: "🏪", label: "Tienda NPC" },
    nodos: { icono: "⚒", label: "Nodos" },
    cultivo: { icono: "🌱", label: "Cultivo" },
    botin: { icono: "⚔", label: "Botín" },
    caza: { icono: "🏹", label: "Caza" },
    alquimia: { icono: "⚗", label: "Subproducto" },
    intercambio: { icono: "⇄", label: "Intercambio" },
    mercado: { icono: "⚖", label: "Mercado" }
};

function crearIconoObtencion(tipo) {
    const metodo = OBTENCION[tipo];
    const badge = document.createElement("span");
    badge.className = "badge_obtencion obtencion_" + tipo;
    badge.title = metodo.label;
    const icono = document.createElement("span");
    icono.setAttribute("aria-hidden", "true");
    icono.textContent = metodo.icono;
    badge.append(icono, document.createTextNode(metodo.label));
    return badge;
}

function crearObtencion(clave) {
    const dato = rdata.datos[clave];
    const info = dato.obtencion;
    const detalles = document.createElement("details");
    detalles.className = "obtencion";
    const resumen = document.createElement("summary");
    resumen.setAttribute("aria-label", "Cómo obtener " + dato.titulo);
    resumen.title = "Ver métodos de obtención y fuentes de " + dato.titulo;
    if (info && info.metodos.length) {
        for (const tipo of info.metodos) resumen.append(crearIconoObtencion(tipo));
    } else {
        resumen.textContent = "ⓘ Obtención sin verificar";
    }
    const texto = document.createElement("p");
    texto.textContent = info ? info.detalle : "Todavía no hay métodos verificados para este ingrediente.";
    detalles.append(resumen, texto);
    if (info) {
        for (const fuente of info.fuentes) {
            const enlace = document.createElement("a");
            enlace.href = fuente;
            enlace.target = "_blank";
            enlace.rel = "noopener noreferrer";
            enlace.textContent = new URL(fuente).hostname.includes("bdocodex") ? "BDO Codex ↗" : "Black Desert SA ↗";
            detalles.append(enlace);
        }
    }
    return detalles;
}

function cambiarVistaBase(vista) {
    vistaBaseActual = vista;

    const btnArbol = document.getElementById("tab_arbol");
    const btnPuros = document.getElementById("tab_puros");
    btnArbol.classList.toggle("activo", vista == "arbol");
    btnPuros.classList.toggle("activo", vista == "puros");

    document.getElementById("ingredientes_base").classList.toggle("oculto", vista != "arbol");
    document.getElementById("ingredientes_puros").classList.toggle("oculto", vista != "puros");

    filtrarIngredientesBase();
}

function filtrarIngredientesPuros(texto) {
    document.querySelectorAll("#ingredientes_puros .ingrediente_puro").forEach(item => {
        const spanTitulo = item.querySelector(".titing");
        const coincide = texto.trim() === "" ||
            (spanTitulo && spanTitulo.textContent.toLowerCase().includes(texto));
        item.style.display = coincide ? "" : "none";
    });
}

function filtrarIngredientesBase() {
    const texto = document.getElementById("buscador_ingredientes").value.toLowerCase();

    if (vistaBaseActual == "puros") {
        filtrarIngredientesPuros(texto);
        return;
    }

    const items = document.querySelectorAll("#ingredientes_base .ingrediente_item");

    items.forEach(item => {
        item.style.display = "";
        item.classList.remove("match_found");
        item.classList.remove("child_of_match");
    });

    if (texto.trim() === "") return;

    items.forEach(item => {
        const spanTitulo = item.querySelector(".titing");
        if (spanTitulo && spanTitulo.textContent.toLowerCase().includes(texto)) {
            item.classList.add("match_found");
        } else {
            item.style.display = "none";
        }
    });

    items.forEach(item => {
        if (item.classList.contains("match_found")) {
            item.querySelectorAll(".ingrediente_item").forEach(child => {
                child.classList.add("child_of_match");
            });
        }
    });

    items.forEach(item => {
        if (item.classList.contains("match_found") || item.classList.contains("child_of_match")) {
            item.style.display = "";
            let parent = item.parentElement.closest(".ingrediente_item");
            while (parent) {
                parent.style.display = "";
                const btn = parent.querySelector(":scope > .ing_wrapper > .ing_contenedor > .btn_expand") ||
                    parent.querySelector(".ing_wrapper > .ing_contenedor > .btn_expand");
                if (btn && btn.getAttribute("data-expanded") === "false") {
                    btn.click();
                }
                parent = parent.parentElement.closest(".ingrediente_item");
            }
        }
    });
}

/* Barra de avance encima de la lista de puros. */
function crearCabeceraProgreso() {
    const li = document.createElement("li");
    li.className = "progreso_puros";

    const txt = document.createElement("span");
    txt.id = "progreso_puros_txt";
    txt.className = "progreso_puros_txt";

    const barra = document.createElement("span");
    barra.className = "b_base b_contenedor progreso_puros_cont";
    const relleno = document.createElement("span");
    relleno.id = "progreso_puros_barra";
    relleno.className = "b_base b_usado";
    relleno.style = "width: 0%;";
    barra.append(relleno);

    const btn = document.createElement("button");
    btn.className = "btn_limpiar_tildes";
    btn.innerText = "Vaciar todo";
    btn.title = "Pone en cero lo juntado de todos los ingredientes";
    btn.addEventListener("click", function () {
        tenidos = {};
        document.querySelectorAll("#ingredientes_puros .ingrediente_puro").forEach(function (el) {
            el.querySelector(".chk_puro").checked = false;
            el.querySelector(".inp_tengo").value = 0;
            el.classList.remove("completado");
            el.classList.remove("parcial");
        });
        actualizarProgresoPuros();
    });

    li.append(txt);
    li.append(barra);
    li.append(btn);
    return li;
}

function actualizarProgresoPuros() {
    const items = document.querySelectorAll("#ingredientes_puros .ingrediente_puro");
    const total = items.length;
    let hechos = 0;
    let avance = 0;

    items.forEach(function (el) {
        const nec = el.bdonecesario || 0;
        const tengo = cantidadTenida(el.bdoclave, nec);
        if (nec > 0 && tengo >= nec) hechos++;
        /* cada ingrediente pesa igual: si no, los que se piden de a 60
           taparían por completo a los que se piden de a 1 */
        if (nec > 0) avance += Math.min(tengo, nec) / nec;
    });

    const pct = total > 0 ? Math.round(avance * 100 / total) : 0;

    const tab = document.getElementById("tab_puros");
    if (tab != null)
        tab.innerText = total > 0
            ? "Ingredientes puros (" + hechos + "/" + total + ")"
            : "Ingredientes puros";

    const barra = document.getElementById("progreso_puros_barra");
    const txt = document.getElementById("progreso_puros_txt");
    if (barra != null) barra.style = "width: " + pct + "%;";
    if (txt != null) txt.innerText = hechos + " de " + total + " completos · " + pct + "%";
}

/* Lista plana con lo que hay que conseguir de verdad: las hojas del árbol,
   es decir todo lo que NO es una receta (ni de alquimia ni de procesamiento).
   Las cantidades son los totales ya acumulados de todas las ramas. */
/* Invertir el mismo árbol que se muestra, incluidos sus redondeos por rama.
   Una proporción directa falla cuando un material aparece en varias subrecetas. */
function elaboracionesConIngrediente(recetaId, clave, disponible) {
    if (!Number.isSafeInteger(disponible) || disponible < 0)
        throw new RangeError("Ingresá una cantidad entera, positiva o cero.");
    const consumo = function (cantidad) {
        const totales = {};
        acumularTotalesArbol(recetaId, cantidad, 0, totales);
        return totales[clave] || 0;
    };
    if (esReceta(clave) || consumo(1) <= 0)
        throw new Error("El ingrediente no pertenece a esta receta.");
    if (disponible === 0) return 0;
    let minimo = 0;
    let maximo = 1;
    while (consumo(maximo) <= disponible) {
        minimo = maximo;
        if (maximo === Number.MAX_SAFE_INTEGER) return maximo;
        maximo = Math.min(maximo * 2, Number.MAX_SAFE_INTEGER);
    }
    while (maximo - minimo > 1) {
        const medio = minimo + Math.floor((maximo - minimo) / 2);
        if (consumo(medio) <= disponible) minimo = medio;
        else maximo = medio;
    }
    return minimo;
}

function crearCantidadPuro(clave, necesario) {
    const contenedor = document.createElement("span");
    contenedor.className = "cantcing";
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "cantcing_local cantidad_puro_editable";
    boton.textContent = "x" + formatearMilesAR(necesario);
    boton.title = "Doble clic para ajustar toda la receta usando esta cantidad";
    boton.setAttribute("aria-label", "Ajustar receta según " + rdata.datos[clave].titulo + ": " + necesario);
    contenedor.append(boton);
    const editar = function () {
        if (contenedor.querySelector("input")) return;
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.className = "editar_cantidad_puro";
        input.value = necesario;
        input.setAttribute("aria-label", "Cantidad para recalcular con " + rdata.datos[clave].titulo);
        input.title = "Enter o salir del campo: aplicar. Escape: cancelar. Se usan elaboraciones completas.";
        boton.hidden = true;
        contenedor.append(input);
        input.focus();
        input.select();
        let terminado = false;
        const cancelar = function () {
            terminado = true;
            input.remove();
            boton.hidden = false;
            boton.focus({ preventScroll: true });
        };
        const confirmar = function () {
            if (terminado) return;
            const texto = input.value.trim();
            const valor = Number(texto.replace(/\./g, ""));
            if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(texto) || !Number.isSafeInteger(valor)) {
                input.setCustomValidity("Ingresá un entero positivo o cero, por ejemplo 1000 o 1.000.");
                input.reportValidity();
                return;
            }
            if (valor === necesario) { cancelar(); return; }
            const cantidad = elaboracionesConIngrediente(currentingrediente, clave, valor);
            terminado = true;
            const abiertos = Array.from(document.querySelectorAll(".ingrediente_puro .obtencion[open]"))
                .map(el => el.closest(".ingrediente_puro").bdoclave);
            document.getElementById("cantidad").value = cantidad;
            recalcularTodo();
            generarListaIngredientes();
            document.querySelectorAll(".ingrediente_puro").forEach(el => {
                if (abiertos.includes(el.bdoclave)) el.querySelector(".obtencion").open = true;
                if (el.bdoclave === clave) {
                    el.querySelector(".cantidad_puro_editable").focus({ preventScroll: true });
                    const aviso = document.getElementById("aviso_recalculo_puro");
                    aviso.textContent = formatearMilesAR(cantidad) + " elaboraciones: se necesitan " +
                        formatearMilesAR(el.bdonecesario) + " de " + rdata.datos[clave].titulo +
                        " de las " + formatearMilesAR(valor) + " indicadas.";
                }
            });
        };
        input.addEventListener("input", () => input.setCustomValidity(""));
        input.addEventListener("blur", confirmar);
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                if (e.key === "Escape") cancelar();
                else confirmar();
            }
        });
    };
    boton.addEventListener("dblclick", editar);
    boton.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); editar(); }
    });
    return contenedor;
}

function crearListaPuros(totalesGlobales, usosGlobales) {
    const ul = document.createElement("ul");
    ul.className = "lista_puros";

    const puros = Object.keys(totalesGlobales)
        .filter(k => !esReceta(k))
        .sort((a, b) => rdata["datos"][a]["titulo"].localeCompare(rdata["datos"][b]["titulo"], "es"));

    for (let k of puros) {
        const li = document.createElement("li");
        li.className = "ingrediente_puro";
        const necesario = Math.ceil(totalesGlobales[k]);
        li.bdoclave = k;
        li.bdonecesario = necesario;

        /* si venía de un estado viejo marcado sólo como "listo", acá se
           convierte en un número concreto: si no, subir la cantidad a
           elaborar lo daría por completo para siempre */
        if (tenidos[k] === COMPLETO_SIN_CANTIDAD) tenidos[k] = necesario;

        /* el tilde es el atajo de "ya lo tengo todo"; el input de al lado es
           para ir anotando lo que juntás. Los dos escriben en `tenidos`, que
           es lo único que se guarda. */
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.className = "chk_puro";
        chk.id = "chk_" + k;
        chk.title = "Marcar como conseguido del todo";
        li.append(chk);

        const span_contenedor = document.createElement("span");
        span_contenedor.className = "ing_contenedor";

        const span_titulo = document.createElement("span");
        span_titulo.className = "ing_titulo_ingrediente";
        span_titulo.innerHTML = `<span class="titing">${rdata["datos"][k]["titulo"]}</span>`;

        span_contenedor.append(span_titulo);
        span_contenedor.append(crearCantidadPuro(k, necesario));
        li.append(span_contenedor);

        const tengoWrap = document.createElement("span");
        tengoWrap.className = "tengo_wrap";

        const inpTengo = document.createElement("input");
        inpTengo.type = "number";
        inpTengo.className = "inp_tengo";
        inpTengo.min = 0;
        inpTengo.value = cantidadTenida(k, necesario);
        /* sin flechitas: acá se escribe el número a mano */
        inpTengo.bdospinner = true;

        const nec = document.createElement("span");
        nec.className = "nec_txt";
        nec.innerText = "/ " + formatearMilesAR(necesario);

        tengoWrap.append(inpTengo);
        tengoWrap.append(nec);
        li.append(tengoWrap);
        li.append(crearObtencion(k));
        chk.setAttribute("aria-label", "Marcar " + rdata.datos[k].titulo + " como conseguido");
        inpTengo.setAttribute("aria-label", "Cantidad conseguida de " + rdata.datos[k].titulo);

        /* después del contador, para que el panel de sustitutos quede último
           y ocupe su propio renglón debajo de toda la fila. Acá el ingrediente
           puede venir de varias ramas, así que van todos sus usos. */
        montarGrupo(span_contenedor, li, k, function () { return usosGlobales[k] || []; });

        const sincronizar = function () {
            const tengo = cantidadTenida(k, necesario);
            const completo = necesario > 0 && tengo >= necesario;
            chk.checked = completo;
            li.classList.toggle("completado", completo);
            li.classList.toggle("parcial", !completo && tengo > 0);
            const falta = Math.max(0, necesario - tengo);
            inpTengo.title = falta > 0 ? "Faltan " + formatearMilesAR(falta) : "Completo";
        };

        inpTengo.addEventListener("input", function () {
            let n = parseInt(this.value, 10);
            if (!isFinite(n) || n < 0) n = 0;
            tenidos[k] = n;
            sincronizar();
            actualizarProgresoPuros();
        });

        chk.addEventListener("change", function () {
            tenidos[k] = this.checked ? necesario : 0;
            inpTengo.value = tenidos[k];
            sincronizar();
            actualizarProgresoPuros();
        });

        sincronizar();
        ul.append(li);
    }

    return { ul: ul, cantidad: puros.length };
}

function generarListaIngredientes() {
    const ulingredientes = document.getElementById("ingredientes_base");
    const ulpuros = document.getElementById("ingredientes_puros");
    ulingredientes.innerHTML = "";
    ulpuros.innerHTML = "";

    const buscadorIngredientes = document.getElementById("buscador_ingredientes");
    if (buscadorIngredientes) {
        buscadorIngredientes.style.display = "";
        buscadorIngredientes.removeEventListener("input", filtrarIngredientesBase);
        buscadorIngredientes.addEventListener("input", filtrarIngredientesBase);
    }

    const cantidad = parseFloat(document.getElementById("cantidad").value) || 0;
    const totalesGlobales = {};
    const usosGlobales = {};
    acumularTotalesArbol(currentingrediente, cantidad, 0, totalesGlobales, usosGlobales);

    const ul = crearArbolIngredientes(currentingrediente, cantidad, 0, totalesGlobales);
    ulingredientes.append(ul);

    /* las dos vistas se arman juntas y se muestra la que esté activa */
    const puros = crearListaPuros(totalesGlobales, usosGlobales);
    ulpuros.append(crearCabeceraProgreso());
    const ayudaEdicion = document.createElement("li");
    ayudaEdicion.className = "ayuda_obtencion";
    ayudaEdicion.textContent = "Doble clic en una cantidad amarilla para recalcular toda la receta con ese ingrediente. Enter aplica y Escape cancela. Lo que ya conseguiste se conserva.";
    const avisoRecalculo = document.createElement("li");
    avisoRecalculo.id = "aviso_recalculo_puro";
    avisoRecalculo.className = "aviso_recalculo_puro";
    avisoRecalculo.setAttribute("role", "status");
    ulpuros.append(ayudaEdicion, avisoRecalculo);
    const ayudaObtencion = document.createElement("li");
    ayudaObtencion.className = "ayuda_obtencion";
    ayudaObtencion.textContent = "Cómo conseguirlos · Tocá los íconos para ver detalles y fuentes. Pueden tener varios métodos. Mercado = compra a otros jugadores, según disponibilidad. Los métodos corresponden al ítem indicado; los sustitutos pueden variar.";
    ulpuros.append(ayudaObtencion);
    ulpuros.append(puros.ul);
    actualizarProgresoPuros();

    if (buscadorIngredientes && buscadorIngredientes.value.trim() !== "") {
        filtrarIngredientesBase();
    }
}

function formatearMilesAR(numero) {
    const valor = Math.floor(Number(numero) || 0);
    return valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function crearSpanCantidad(cantidadLocal, cantidadTotalGlobal) {
    const spanCant = document.createElement("span");
    spanCant.className = "cantcing";

    const spanLocal = document.createElement("span");
    spanLocal.className = "cantcing_local";
    spanLocal.textContent = "x" + formatearMilesAR(cantidadLocal);
    spanCant.append(spanLocal);

    if (cantidadTotalGlobal > cantidadLocal) {
        const spanTotal = document.createElement("span");
        spanTotal.className = "cantcing_total";
        spanTotal.textContent = " (" + formatearMilesAR(cantidadTotalGlobal) + " total)";
        spanCant.append(spanTotal);
    }

    return spanCant;
}

/* Cuántas veces hay que elaborar la receta 'recetaId' para obtener 'cantidad'
   ítems. En el nivel 0 la cantidad que escribió el usuario YA son elaboraciones. */
function elaboracionesNecesarias(recetaId, cantidad, nivel) {
    if (nivel === 0)
        return cantidad;
    return Math.ceil(cantidad / ratioDeReceta(recetaId));
}

/* Además del total, anota cada "uso": cuántas unidades pide la receta por
   elaboración y cuántas veces se elabora. Un mismo ingrediente puede entrar
   por varias ramas con cantidades distintas, y los sustitutos de grupo se
   calculan por elaboración, no sobre el total. */
function acumularTotalesArbol(recetaId, cantidad, nivel, totalesGlobales, usosGlobales) {
    const ingredientes = ingredientesDe(recetaId);
    const keysLista = Object.keys(ingredientes).sort();
    const veces = elaboracionesNecesarias(recetaId, cantidad, nivel);

    for (let ingId of keysLista) {
        const porElaboracion = Number(ingredientes[ingId]);
        const cantidad_ing = Math.ceil(veces * porElaboracion);
        if (!totalesGlobales[ingId]) {
            totalesGlobales[ingId] = 0;
        }
        totalesGlobales[ingId] += cantidad_ing;

        if (usosGlobales != undefined) {
            if (!usosGlobales[ingId]) usosGlobales[ingId] = [];
            usosGlobales[ingId].push({ "q": porElaboracion, "veces": veces });
        }

        if (esReceta(ingId)) {
            acumularTotalesArbol(ingId, cantidad_ing, nivel + 1, totalesGlobales, usosGlobales);
        }
    }
}

function crearArbolIngredientes(recetaId, cantidad, nivel, totalesGlobales) {
    const ul = document.createElement("ul");
    ul.className = "ingredientes_arbol nivel_" + nivel;

    const ingredientes = ingredientesDe(recetaId);
    const keysLista = Object.keys(ingredientes).sort();
    const veces = elaboracionesNecesarias(recetaId, cantidad, nivel);

    for (let ingId of keysLista) {
        const li = document.createElement("li");
        li.className = "ingrediente_item";

        const subreceta = esReceta(ingId);
        const cantidad_ing = Math.ceil(veces * ingredientes[ingId]);
        const cantidad_total_global = Math.ceil(totalesGlobales[ingId] || 0);

        const span_contenedor = document.createElement("span");
        span_contenedor.className = "ing_contenedor";

        if (subreceta) {
            li.classList.add("nodo_" + grupoDe(ingId));

            const btnExpand = document.createElement("button");
            btnExpand.className = "btn_expand";
            btnExpand.textContent = "▼";
            btnExpand.setAttribute("data-expanded", "true");

            const divContenedor = document.createElement("div");
            divContenedor.className = "ing_wrapper";

            const span_titulo = document.createElement("span");
            span_titulo.className = "ing_titulo_receta";
            span_titulo.innerHTML = `<span class="titing">${rdata["datos"][ingId]["titulo"]}</span>`;

            const span_cant = crearSpanCantidad(cantidad_ing, cantidad_total_global);

            btnExpand.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                const expanded = btnExpand.getAttribute("data-expanded") === "true";
                const subArbol = divContenedor.querySelector(".ingredientes_arbol");

                if (expanded) {
                    subArbol.classList.add("oculto");
                    btnExpand.textContent = "▶";
                    btnExpand.setAttribute("data-expanded", "false");
                } else {
                    subArbol.classList.remove("oculto");
                    btnExpand.textContent = "▼";
                    btnExpand.setAttribute("data-expanded", "true");
                }
            });

            span_contenedor.append(btnExpand);
            span_contenedor.append(span_titulo);
            span_contenedor.append(span_cant);
            span_contenedor.append(crearBadgeTipo(ingId));

            const subArbol = crearArbolIngredientes(ingId, cantidad_ing, nivel + 1, totalesGlobales);

            divContenedor.append(span_contenedor);
            divContenedor.append(subArbol);

            li.append(divContenedor);
        } else {
            const span_titulo = document.createElement("span");
            span_titulo.className = "ing_titulo_ingrediente";
            span_titulo.innerHTML = `<span class="titing">${rdata["datos"][ingId]["titulo"]}</span>`;

            const span_cant = crearSpanCantidad(cantidad_ing, cantidad_total_global);

            span_contenedor.append(span_titulo);
            span_contenedor.append(span_cant);
            li.append(span_contenedor);
            montarGrupo(span_contenedor, li, ingId, function () {
                return [{ "q": Number(ingredientes[ingId]), "veces": veces }];
            });
        }

        ul.append(li);
    }

    return ul;
}

function actualizarIngredientes(valor) {
    let platatotal = 0;
    let pesototal = 0;

    for (let ingx of inglist) {

        let inputcocic = document.getElementById(ingx + "_cant");
        inputcocic.value = valor * Math.ceil(inputcocic.bdocant / calidad_ing[calidades[inputcocic.bdogrado]]);
        let titletag = document.getElementById("titulo_" + ingx);
        let platainp = document.getElementById("inpplata_" + ingx);
        let costo = platainp.value.replace(/\./g, "");
        if (gastoIngCalculados[ingx])
            platatotal += costo * inputcocic.value;
        if (titletag.localName == "a")
            titletag.href = enlaceReceta(ingx, inputcocic.value);

        pesototal += parseFloat(rdata["datos"][ingx]["peso"]) * inputcocic.value;

    }
    document.getElementById("gasto").innerText = "$ " + formatearMilesAR(platatotal);
    setPeso(pesototal);
    refrescarPanelesGrupo();
}

/* El enlace lleva la cantidad pedida y los ratios, así la pestaña nueva
   abre la sub-receta con el mismo contexto. */
function enlaceReceta(id, total) {
    const ratio = document.getElementById("ratio");
    const ratio_proc = document.getElementById("ratio_proc");
    let url = "?id=" + id;
    if (total != undefined)
        url += "&t=" + total;
    if (ratio != null)
        url += "&r=" + ratio.value;
    if (ratio_proc != null)
        url += "&rp=" + ratio_proc.value;
    return url;
}

function recalcularTodo() {
    const cantidad = document.getElementById("cantidad");
    const e = new Event("input");
    cantidad.dispatchEvent(e);
}

function modificarSegunRatio() {
    const total = document.getElementById("total");
    const cantidad = document.getElementById("cantidad");
    total.value = Math.floor(ratioDeReceta(currentingrediente) * cantidad.value);
    actualizarIngredientes(cantidad.value);
    generarListaIngredientesSiHay();
}

function setPeso(p) {
    document.getElementById("peso").innerText = "LT " + p.toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    gpeso = p;
}

function modificadorIngrediente(e) {
    const cantidadr = Math.floor(this.value / Math.ceil(this.bdocant / calidad_ing[calidades[this.bdogrado]]));
    let platatotal = 0;
    let pesototal = 0;
    for (let ingx of inglist) {
        const inputcocic = document.getElementById(ingx + "_cant");
        const platainp = document.getElementById("inpplata_" + ingx);
        const costo = platainp.value.replace(/\./g, "");

        if (this.bdoing != ingx) {
            inputcocic.value = cantidadr * Math.ceil(inputcocic.bdocant / calidad_ing[calidades[inputcocic.bdogrado]]);
        }
        if (gastoIngCalculados[ingx])
            platatotal += costo * inputcocic.value;
        const titletag = document.getElementById("titulo_" + ingx);
        if (titletag.localName == "a")
            titletag.href = enlaceReceta(ingx, inputcocic.value);
        pesototal += parseFloat(rdata["datos"][ingx]["peso"]) * inputcocic.value;
    }
    document.getElementById("gasto").innerText = "$ " + formatearMilesAR(platatotal);
    setPeso(pesototal);
    refrescarPanelesGrupo();

    const cantidadinp = document.getElementById("cantidad");
    const total = document.getElementById("total");
    cantidadinp.value = cantidadr;
    total.value = Math.floor(cantidadr * ratioDeReceta(currentingrediente));
    updatePeso();
}

function modificarSegunCantidad() {
    actualizarIngredientes(this.value);
    const total = document.getElementById("total");
    total.value = Math.floor(this.value * ratioDeReceta(currentingrediente));
    updatePeso();
}

function modificarSegunTotal() {
    const cantidadx = document.getElementById("cantidad");
    cantidadx.value = Math.ceil(this.value / ratioDeReceta(currentingrediente));
    actualizarIngredientes(cantidadx.value);
    updatePeso();
}

function crearCaja(cname, idname) {
    const box = document.createElement("span");
    box.className = "cajita " + cname;
    box.id = "box_" + idname + "_" + cname;
    box.addEventListener("click", seleccionarCaja);
    return box;
}

/* Los campos de peso pueden estar vacíos: sin esto parseFloat("") = NaN y el
   NaN se propaga al texto y al ancho de las barras. */
function numeroSeguro(valor) {
    const n = parseFloat(valor);
    return isFinite(n) ? n : 0;
}

function calcPrct(total, usado) {
    total = numeroSeguro(total);
    usado = numeroSeguro(usado);
    if (total <= 0)
        return 0;
    const p = (usado * 100) / total;
    return p > 100 ? 100 : p;
}

function seleccionarCaja() {
    const cajas = ["normal", "verde", "azul"];
    const datos = this.id.split("_");
    if (!this.className.includes("seleccionado") && !this.className.includes("vacia")) {
        this.className += " seleccionado";
        const titulospan = document.getElementById("titulo_" + datos[1]);

        const inputx = document.getElementById(datos[1] + "_cant");
        titulospan.innerText = rdata["datos"][datos[1]]["titulo"] + " x" + Math.ceil(inputx.bdocant / calidad_ing[calidades[datos[2]]]);
        document.getElementById(datos[1] + "_cant").bdogrado = datos[2];
        const e = new Event("input");
        inputx.dispatchEvent(e);
        for (let cc of cajas) {
            if (cc != datos[2]) {
                const bx = document.getElementById("box_" + datos[1] + "_" + cc);
                bx.className = "cajita " + cc;
            }
        }
    }
}

let secondLoad = false;

let gastoIngCalculados = {};

function updatePeso() {
    const pmax = numeroSeguro(document.getElementById("pesomax").value);
    const pmio = numeroSeguro(document.getElementById("mipeso").value);

    const bocupado = document.getElementById("bocupado");
    const busado = document.getElementById("busado");

    let pocupado = calcPrct(pmax, pmio);
    let pusado = calcPrct(pmax, gpeso);
    const resultado = Math.round(((pmio + numeroSeguro(gpeso)) + Number.EPSILON) * 100) / 100;

    const pocup = document.getElementById("pesoocu")
    const pomax = document.getElementById("pesotot");
    pocup.innerText = resultado.toFixed(2);
    pomax.innerText = "/ " + pmax.toFixed(2) + " LT";

    /* sin peso máximo cargado no hay nada que avisar */
    if (pmax <= 0)
        pocup.style = "none";
    else if ((pmax - resultado) < 50)
        if ((pmax - resultado) < 0)
            pocup.style = "color: red;";
        else
            pocup.style = "color: orange";
    else
        pocup.style = "none";

    bocupado.style = "width: " + pocupado + "%;";
    if (pocupado + pusado > 100) {
        pusado = 100 - pocupado;
        if (pusado < 0)
            pusado = 0;
    }
    busado.style = "width: " + pusado + "%;";
}

function guardarPreferencias() {
    const ratio = document.getElementById("ratio");
    const ratio_proc = document.getElementById("ratio_proc");
    const pesomax = document.getElementById("pesomax").value;
    const mipeso = document.getElementById("mipeso").value;
    this.disabled = true;
    this.style = "opacity: 0.5;"
    this.innerText = "Guardando...";
    const dictSave =
    {
        "ratio": ratio != null ? ratio.value : "2.5",
        "ratio_proc": ratio_proc != null ? ratio_proc.value : "2.5",
        "pesomax": pesomax,
        "mipeso": mipeso
    }
    localStorage.setItem("preferencias_alquimia", JSON.stringify(dictSave));
    setTimeout(function () { this.disabled = false; this.style = ""; this.innerText = "Guardar preferencias" }.bind(this), 300);
}

function leerPreferencias() {
    const p = localStorage.getItem("preferencias_alquimia");
    if (p == null || p == "") return {};
    try { return JSON.parse(p); } catch (e) { return {}; }
}

/* -----------------------------------------------------------------
   Estado de progreso
   -----------------------------------------------------------------
   Distinto de las preferencias: las preferencias son los ajustes que
   valen para toda la calculadora (ratios, peso de la mula), mientras que
   el estado es el avance concreto de UNA receta — cuánto vas a hacer, a
   qué precio, con qué calidades y qué ingredientes ya conseguiste.
   Se guarda uno por receta y se restaura solo al abrirla.
   ----------------------------------------------------------------- */
const CLAVE_ESTADO = "estado_alquimia";

/* Cuánto llevás juntado de cada ingrediente puro de la receta abierta:
   { clave: cantidad }. El tilde no se guarda aparte — un ingrediente está
   completo cuando lo que tenés llega a lo que hace falta.
   El valor especial COMPLETO_SIN_CANTIDAD viene de estados guardados con la
   versión anterior, que sólo anotaba "listo" sin cuánto. */
let tenidos = {};
const COMPLETO_SIN_CANTIDAD = -1;

function cantidadTenida(clave, necesario) {
    const t = tenidos[clave];
    if (t === COMPLETO_SIN_CANTIDAD) return necesario;
    return t > 0 ? t : 0;
}

function leerEstados() {
    const p = localStorage.getItem(CLAVE_ESTADO);
    if (p == null || p == "") return {};
    try { return JSON.parse(p) || {}; } catch (e) { return {}; }
}

function valorDe(id) {
    const e = document.getElementById(id);
    return e == null ? undefined : e.value;
}

function ponerValor(id, valor) {
    const e = document.getElementById(id);
    if (e != null && valor != undefined) e.value = valor;
}

function guardarEstado() {
    const est = {
        "v": 1,
        "fecha": Date.now(),
        "cantidad": valorDe("cantidad"),
        "ratio": valorDe("ratio"),
        "ratio_proc": valorDe("ratio_proc"),
        "pesomax": valorDe("pesomax"),
        "mipeso": valorDe("mipeso"),
        "vista": vistaBaseActual,
        "calidades": {},
        "precios": {},
        "gastos": [],
        "tenidos": {}
    };

    /* sólo lo que tiene algo juntado, para no engordar el localStorage */
    for (let k in tenidos) {
        if (tenidos[k] > 0 || tenidos[k] === COMPLETO_SIN_CANTIDAD)
            est["tenidos"][k] = tenidos[k];
    }

    for (let ing of inglist) {
        const inp = document.getElementById(ing + "_cant");
        if (inp != null && inp.bdogrado != "normal")
            est["calidades"][ing] = inp.bdogrado;
        const pl = document.getElementById("inpplata_" + ing);
        if (pl != null && pl.value != rdata["datos"][ing]["plata"])
            est["precios"][ing] = pl.value;
        if (gastoIngCalculados[ing])
            est["gastos"].push(ing);
    }

    const todos = leerEstados();
    todos[currentingrediente] = est;
    localStorage.setItem(CLAVE_ESTADO, JSON.stringify(todos));

    this.disabled = true;
    this.style = "opacity: 0.5;";
    this.innerText = "Guardando...";
    setTimeout(function () {
        this.disabled = false; this.style = ""; this.innerText = "Guardar estado";
    }.bind(this), 300);
}

function borrarEstado(recetaId) {
    const todos = leerEstados();
    delete todos[recetaId];
    localStorage.setItem(CLAVE_ESTADO, JSON.stringify(todos));
}

function fechaCorta(ms) {
    const d = new Date(ms);
    const p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

function mostrarAvisoEstado(est) {
    const cab = document.getElementById("cabecera_receta");
    const aviso = document.createElement("div");
    aviso.id = "aviso_estado";
    aviso.className = "aviso_estado";

    const txt = document.createElement("span");
    txt.innerText = "Estado restaurado" + (est["fecha"] ? " · guardado el " + fechaCorta(est["fecha"]) : "");
    aviso.append(txt);

    const btn = document.createElement("button");
    btn.className = "btn_descartar";
    btn.innerText = "Descartar";
    btn.title = "Borra el estado guardado de esta receta y empieza de cero";
    btn.addEventListener("click", function () {
        borrarEstado(currentingrediente);
        const o = { "id": currentingrediente };
        o.setAndLoad = setAndLoad;
        o.setAndLoad();
    });
    aviso.append(btn);

    cab.parentNode.insertBefore(aviso, cab.nextSibling);
}

/* Aplica el estado sobre una receta recién montada. El orden importa: las
   calidades cambian cuánto rinde cada ingrediente, así que van antes de
   fijar la cantidad, que es lo que dispara el recálculo general. */
function aplicarEstado(est) {
    ponerValor("ratio", est["ratio"]);
    ponerValor("ratio_proc", est["ratio_proc"]);

    const cal = est["calidades"] || {};
    for (let ing in cal) {
        const caja = document.getElementById("box_" + ing + "_" + cal[ing]);
        if (caja != null) caja.click();
    }

    const pre = est["precios"] || {};
    for (let ing in pre) ponerValor("inpplata_" + ing, pre[ing]);

    for (let ing of (est["gastos"] || [])) {
        const b = document.getElementById("actplata_" + ing);
        if (b != null && !gastoIngCalculados[ing]) b.click();
    }

    ponerValor("pesomax", est["pesomax"]);
    ponerValor("mipeso", est["mipeso"]);

    tenidos = {};
    const guardados = est["tenidos"] || {};
    for (let k in guardados) tenidos[k] = guardados[k];
    /* estados de la versión anterior: sólo anotaban qué estaba listo, sin cuánto */
    for (let k of (est["completados"] || [])) {
        if (tenidos[k] == undefined) tenidos[k] = COMPLETO_SIN_CANTIDAD;
    }

    const c = document.getElementById("cantidad");
    c.value = est["cantidad"] || 0;
    c.dispatchEvent(new Event("input"));
    updatePeso();

    generarListaIngredientes();
    if (est["vista"]) cambiarVistaBase(est["vista"]);

    mostrarAvisoEstado(est);
}

/* Cabecera: qué es esta receta y cómo se elabora. */
function construirCabecera(id) {
    let cab = document.getElementById("cabecera_receta");
    if (cab == null) {
        cab = document.createElement("div");
        cab.id = "cabecera_receta";
        const cont = document.getElementById("contenido");
        cont.insertBefore(cab, document.querySelector(".seccion"));
    }
    const grupo = grupoDe(id);
    cab.className = "tipo_" + grupo;
    cab.innerHTML = "";

    const nombre = document.createElement("span");
    nombre.className = "nombre_receta";
    nombre.innerText = rdata["datos"][id]["titulo"];
    cab.append(nombre);
    cab.append(crearBadgeTipo(id));

    if (rdata["datos"][id]["nivel"]) {
        const niv = document.createElement("span");
        niv.className = "nivel_receta";
        niv.innerText = rdata["datos"][id]["nivel"];
        cab.append(niv);
    }

    const ayuda = document.createElement("span");
    ayuda.className = "ayuda_tipo";
    ayuda.innerText = AYUDA_TIPO[grupo];
    cab.append(ayuda);
    const fuente = rdata.recetas[id].fuente;
    if (fuente) {
        const enlace = document.createElement("a");
        enlace.className = "fuente_receta";
        enlace.href = fuente;
        enlace.target = "_blank";
        enlace.rel = "noopener noreferrer";
        enlace.textContent = "Ver receta en la fuente ↗";
        cab.append(enlace);
    }
}

function setAndLoad() {
    gastoIngCalculados = {};
    modoseleccion = false;

    /* al cambiar de receta se limpia el avance y las listas calculadas: si
       quedaran las de la receta anterior, "Guardar estado" grabaría datos
       que no son de esta receta */
    tenidos = {};
    const avisoViejo = document.getElementById("aviso_estado");
    if (avisoViejo != null) avisoViejo.remove();
    for (let idLista of ["ingredientes_base", "ingredientes_puros"]) {
        const ul = document.getElementById(idLista);
        if (ul != null) ul.innerHTML = "<li>Sin calcular aún</li>";
    }
    const tabPuros = document.getElementById("tab_puros");
    if (tabPuros != null) tabPuros.innerText = "Ingredientes puros";
    const buscadorIng = document.getElementById("buscador_ingredientes");
    if (buscadorIng != null) { buscadorIng.value = ""; buscadorIng.style.display = "none"; }
    const t = rdata["datos"][this.id]["titulo"];
    document.title = t + " - Alquimia BDO";
    inglist = [];
    const buscador = document.getElementById("buscador");
    const lista_recetas = document.getElementById("lista_recetas");
    buscador.value = t;
    setTimeout(function () { lista_recetas.style = "display: none"; }, 50)
    const ilista = document.getElementById("ingredientes");
    ilista.innerHTML = "";
    if (secondLoad)
        window.history.pushState(this.id, "Titulo", "?id=" + this.id);
    else {
        const url = new URL(window.location.href);
        url.searchParams.set("id", this.id);
        window.history.replaceState(this.id, "Titulo", url);
    }
    currentingrediente = this.id;
    const ingredientes = ingredientesDe(this.id);
    const grupo = grupoDe(this.id);
    const otros = document.getElementById("otros");
    otros.innerHTML = "";

    construirCabecera(this.id);

    for (let ird of Object.keys(ingredientes)) {
        inglist.push(ird);
        let lix = document.createElement("li");
        let spanmoney = document.createElement("span");
        spanmoney.className = "signplata";

        let spancash = document.createElement("span");
        spancash.className = "valx";
        spancash.innerText = "$";
        spancash.id = "actplata_" + ird;
        spancash.bdoing = ird;

        spancash.addEventListener("click", function () {
            if (!gastoIngCalculados[this.bdoing]) {
                gastoIngCalculados[this.bdoing] = true;
                this.className = "valx vpressed";
            } else {
                gastoIngCalculados[this.bdoing] = false;
                this.className = "valx";
            }
            recalcularTodo();
        });

        let spanmas = document.createElement("span");

        let spanplatainput = document.createElement("span");
        spanplatainput.className = "oculto";
        spanplatainput.id = "expplata_" + ird;

        let inputplata = document.createElement("input");
        inputplata.id = "inpplata_" + ird;
        inputplata.value = rdata["datos"][ird]["plata"];
        inputplata.addEventListener("input", function () {
            const original = this.value.replace(/\./g, "");
            this.value = original.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            recalcularTodo();
        });

        spanplatainput.append(inputplata);

        let spanbotonplata = document.createElement("span");
        spanbotonplata.innerText = "+";
        spanbotonplata.ingid = ird;
        spanbotonplata.addEventListener("click", function () {
            const spaninput = document.getElementById("expplata_" + this.ingid);
            if (this.innerText == "+")
                this.innerText = " - ";
            else
                this.innerText = " + ";
            if (spaninput.className == "oculto")
                spaninput.className = "normal";
            else
                spaninput.className = "oculto";
        });

        spanmas.append(spanplatainput);
        spanmas.append(spanbotonplata);
        spanmas.className = "expandir";

        spanmoney.append(spancash);
        spanmoney.append(spanmas);

        let isLink = esReceta(ird);
        let tipoing = isLink ? "a" : "span";

        let spantitle = document.createElement(tipoing);
        spantitle.innerText = rdata["datos"][ird]["titulo"] + " x" + ingredientes[ird] + " "
        spantitle.className = "titulo";
        spantitle.id = "titulo_" + ird;
        if (isLink) {
            spantitle.href = enlaceReceta(ird);
            spantitle.target = "_blank";
        }

        lix.append(spanmoney);

        /* El badge dice de dónde sale este ingrediente: alquimia, alquimia
           simple o procesamiento. La marca ↻ dice que acepta su grupo.

           Título, badge y marca van juntos dentro de .ing_cabeza: como el <li>
           es flex-wrap, sin este contenedor un título largo hace que las cajas
           de cantidad se vayan a una línea nueva. */
        let cabeza = document.createElement("span");
        cabeza.className = "ing_cabeza";
        cabeza.append(spantitle);
        if (isLink)
            cabeza.append(crearBadgeTipo(ird));

        /* la marca ↻ va acá, pero el panel desplegable se cuelga del <li>
           entero para que caiga en su propia línea, debajo de las cajitas */
        let contMarca = document.createElement("span");
        contMarca.className = "cont_marca";
        cabeza.append(contMarca);
        lix.append(cabeza);

        let spansector = document.createElement("span");
        spansector.className = "seccajas";

        let inputcant = document.createElement("input");
        inputcant.addEventListener("input", modificadorIngrediente);
        inputcant.className = "reccant";
        inputcant.id = ird + "_cant";
        inputcant.type = "number";
        inputcant.bdoing = ird;
        inputcant.bdocant = ingredientes[ird];
        inputcant.bdogrado = "normal";

        spansector.append(inputcant)
        if (rdata["datos"][ird]["nomejorable"] == undefined) {
            spansector.append(crearCaja("normal", ird));
            spansector.append(crearCaja("verde", ird));
            spansector.append(crearCaja("azul", ird));
        } else {
            spansector.append(crearCaja("vacia", ird));
            spansector.append(crearCaja("vacia", ird));
            spansector.append(crearCaja("vacia", ird));
        }

        lix.append(spansector)
        montarGrupo(contMarca, lix, ird, function () {
            const inp = document.getElementById(ird + "_cant");
            const cant = document.getElementById("cantidad");
            if (inp == null || cant == null) return [];
            /* lo que pide la receta por elaboración, ya con la calidad elegida */
            const q = Math.ceil(inp.bdocant / calidad_ing[calidades[inp.bdogrado]]);
            return [{ "q": q, "veces": Number(cant.value) || 0 }];
        });
        ilista.append(lix);
    }

    const prefs = leerPreferencias();
    const rAlq = prefs["ratio"] != undefined ? prefs["ratio"] : 2.5;
    const rProc = prefs["ratio_proc"] != undefined ? prefs["ratio_proc"] : 2.5;

    const ajustes = document.createElement("details");
    ajustes.id = "ajustes_generales";
    const resumenAjustes = document.createElement("summary");
    resumenAjustes.textContent = "⚙ Preferencias de la calculadora";
    const ayudaAjustes = document.createElement("p");
    ayudaAjustes.className = "ayuda_guardado";
    ayudaAjustes.textContent = "Ratios y peso predeterminados para todas las recetas.";
    const listaAjustes = document.createElement("ul");
    ajustes.append(resumenAjustes, ayudaAjustes, listaAjustes);

    let cant = crearElementoLi(otros, VERBO_TIPO[grupo], "cantidad");
    cant.children[1].addEventListener("input", modificarSegunCantidad);

    /* Alquimia Simple rinde x1 fijo: no tiene sentido un ratio editable.
       Los otros dos ratios se muestran igual porque el árbol de ingredientes
       de abajo mezcla alquimia con procesamiento. */
    if (grupo == "simple") {
        let fijo = crearElementoLi(otros, "Ratio: ", "ratio_fijo", true);
        fijo.children[1].innerText = "x1 · Alquimia Simple no tiene bono de maestría";
        fijo.children[1].className = "fijo_txt";
    }

    let ratio = crearElementoLi(listaAjustes,
        grupo == "alquimia" ? "Ratio de Alquimia: " : "Ratio de Alquimia (sub-recetas): ", "ratio");
    ratio.classList.add("ratio_txt");
    ratio.children[1].value = rAlq;
    ratio.children[1].step = 0.1;
    ratio.children[1].addEventListener("input",
        grupo == "alquimia" ? modificarSegunRatio : generarListaIngredientesSiHay);

    let ratio_proc = crearElementoLi(listaAjustes,
        grupo == "proc" ? "Ratio de Procesamiento: " : "Ratio de Procesamiento (sub-recetas): ", "ratio_proc");
    ratio_proc.classList.add("ratio_proc_txt");
    ratio_proc.children[1].value = rProc;
    ratio_proc.children[1].step = 0.1;
    ratio_proc.children[1].addEventListener("input",
        grupo == "proc" ? modificarSegunRatio : generarListaIngredientesSiHay);

    let nli = document.createElement("li");
    nli.classList.add("botonera");
    let boton = document.createElement("button");
    let botonsave = document.createElement("button");
    botonsave.innerText = "Guardar preferencias";
    botonsave.classList.add("savebtn");
    botonsave.title = "Ratios y peso, para todas las recetas";
    botonsave.onclick = guardarPreferencias;

    /* el avance de ESTA receta, aparte de las preferencias generales */
    let botonestado = document.createElement("button");
    botonestado.innerText = "Guardar estado";
    botonestado.classList.add("estadobtn");
    botonestado.title = "Cantidad, precios, calidades y lo ya conseguido de esta receta";
    botonestado.onclick = guardarEstado;

    boton.innerText = "Calcular Ingredientes";
    boton.addEventListener("click", generarListaIngredientes);
    nli.append(boton);
    ajustes.append(botonsave);

    let avance = document.getElementById("acciones_estado");
    if (!avance) {
        avance = document.createElement("div");
        avance.id = "acciones_estado";
        const tabs = document.getElementById("tabs_base");
        tabs.parentNode.insertBefore(avance, tabs);
    }
    avance.replaceChildren();
    const ayudaEstado = document.createElement("div");
    const tituloEstado = document.createElement("strong");
    tituloEstado.textContent = "Avance de esta receta";
    const detalleEstado = document.createElement("p");
    detalleEstado.className = "ayuda_guardado";
    detalleEstado.textContent = "Guardá cantidades, precios, calidades e ingredientes conseguidos. Se restaura al volver a abrirla.";
    ayudaEstado.append(tituloEstado, detalleEstado);
    avance.append(ayudaEstado, botonestado);

    let total = crearElementoLi(otros, "Total obtenidos: ", "total");
    total.children[1].addEventListener("input", modificarSegunTotal);

    crearElementoLi(otros, "Gasto", "gasto", false);
    let ppeso = crearElementoLi(otros, "Peso", "peso", false);

    let divpeso = document.createElement("div");
    divpeso.className = "pextra";

    let aextra = document.createElement("a");
    aextra.onclick = function () {
        const d = document.getElementById("pi5");
        if (!d.mostrar) {
            this.children[1].innerText = " Mostrar opciones peso";
            this.children[0].innerText = "+";
            d.style = "display: none;";
        } else {
            this.children[1].innerText = " Ocultar opciones peso";
            this.children[0].innerText = "-";
            d.style = "display: block;";
        }
        d.mostrar = !d.mostrar;
    }
    aextra.innerHTML = "<span>+</span><b>Mostrar opciones peso</b>";
    divpeso.append(aextra);
    let dinputpeso = document.createElement("div");
    dinputpeso.className = "pinputs";
    dinputpeso.id = "pi5";
    dinputpeso.mostrar = true;
    dinputpeso.style = "display: none;";

    divpeso.append(dinputpeso);
    ajustes.insertBefore(divpeso, botonsave);

    let pesomax = crearElementoLi(dinputpeso, "Peso máx", "pesomax");
    pesomax.children[1].step = 0.01;
    pesomax.children[1].oninput = function () { updatePeso(); };

    let mipeso = crearElementoLi(dinputpeso, "Mi peso", "mipeso");
    mipeso.children[1].step = 0.01;
    mipeso.children[1].oninput = function () { updatePeso(); };

    let pbarras = document.createElement("li");
    pbarras.innerHTML = "<span class=\"b_base b_contenedor\"><span id=\"bocupado\" class=\"b_base b_pocupado\" style=\"width: 0%;\"></span><span id=\"busado\" class=\"b_base b_usado\" style=\"width: 0%;\"></span></span>";
    dinputpeso.append(pbarras);

    let infopesox = document.createElement("div");
    let spaninfpoc = document.createElement("span");
    spaninfpoc.id = "pesoocu";
    let spaninfpto = document.createElement("span");
    spaninfpto.id = "pesotot";

    spaninfpoc.innerText = "0.00";
    spaninfpto.innerText = "/ 0.00";

    let fbutton = document.createElement("span");
    fbutton.className = "fillbtn";
    fbutton.innerText = "LLENAR";

    fbutton.onclick = function () {
        const pmax = numeroSeguro(document.getElementById("pesomax").value);
        const pmio = numeroSeguro(document.getElementById("mipeso").value);

        const disponible = pmax - pmio;

        let pesodata = 0;
        for (let ingx of inglist) {
            let inputcocic = document.getElementById(ingx + "_cant");
            const ddato = 1 * Math.ceil(inputcocic.bdocant / calidad_ing[calidades[inputcocic.bdogrado]]);
            pesodata += parseFloat(rdata["datos"][ingx]["peso"]) * ddato;
        }
        /* sin peso máximo cargado, o con ingredientes sin peso, no hay nada que llenar */
        if (disponible <= 0 || pesodata <= 0)
            return;

        const tinput = document.getElementById("cantidad");
        tinput.value = Math.floor((disponible / pesodata) * 0.95);
        let e = new Event("input");
        tinput.dispatchEvent(e);
    }
    infopesox.append(spaninfpoc);
    infopesox.append(spaninfpto);
    infopesox.append(fbutton);

    ppeso.children[1].innerText = "LT 0.00";
    otros.append(nli);
    const filaAjustes = document.createElement("li");
    filaAjustes.className = "fila_ajustes";
    filaAjustes.append(ajustes);
    otros.append(filaAjustes);
    dinputpeso.append(infopesox);

    if (prefs["pesomax"] != undefined) pesomax.children[1].value = prefs["pesomax"];
    if (prefs["mipeso"] != undefined) mipeso.children[1].value = prefs["mipeso"];

    if (!secondLoad) {
        if (ratioget != null)
            ratio.children[1].value = ratioget;
        if (ratioprocget != null)
            ratio_proc.children[1].value = ratioprocget;
        if (totalget != null) {
            total.children[1].value = totalget;
            let e = new Event("input");
            total.children[1].dispatchEvent(e);
        }
    }

    /* los spinners nativos no combinan con el tema: los reemplazamos */
    ponerSpinners(document.getElementById("contenido"));

    /* si esta receta tiene avance guardado, se restaura encima de todo lo anterior */
    const estadoGuardado = leerEstados()[this.id];
    if (estadoGuardado != undefined)
        aplicarEstado(estadoGuardado);

    secondLoad = true;
}

function generarListaIngredientesSiHay() {
    if (document.querySelector("#ingredientes_base .ingrediente_item") != null)
        generarListaIngredientes();
}

/* -----------------------------------------------------------------
   Flechitas de los inputs numéricos
   -----------------------------------------------------------------
   Las nativas son grises y no hay forma de tematizarlas de verdad, así que
   se ocultan por CSS y se reemplazan por estas, que respetan el `step` del
   input y disparan el mismo evento `input` que escribir a mano.
   ----------------------------------------------------------------- */
function crearBotonSpinner(inp, dir, glifo) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "spin_btn";
    b.innerText = glifo;
    b.tabIndex = -1;
    b.addEventListener("click", function (e) {
        e.preventDefault();
        const paso = parseFloat(inp.step) || 1;
        const actual = parseFloat(inp.value);
        let n = (isFinite(actual) ? actual : 0) + dir * paso;
        if (n < 0) n = 0;
        /* sumar decimales en coma flotante deja cosas como 2.5000000000000004 */
        const dec = (String(paso).split(".")[1] || "").length;
        inp.value = dec > 0 ? parseFloat(n.toFixed(dec)) : Math.round(n);
        inp.dispatchEvent(new Event("input"));
    });
    return b;
}

function ponerSpinners(raiz) {
    raiz.querySelectorAll('input[type="number"]').forEach(function (inp) {
        if (inp.bdospinner) return;
        inp.bdospinner = true;

        const cont = document.createElement("span");
        cont.className = "spinner";
        cont.append(crearBotonSpinner(inp, 1, "▲"));
        cont.append(crearBotonSpinner(inp, -1, "▼"));
        inp.after(cont);

        if (inp.parentElement != null)
            inp.parentElement.classList.add("con_spinner");
    });
}

function crearElementoLi(donde, texto, id, sininput) {
    let lix = document.createElement("li");
    let spantitle = document.createElement("span");
    spantitle.innerText = texto;
    let inputcant;
    if (sininput == undefined) {
        inputcant = document.createElement("input");
        inputcant.className = "cantidadtotal";
        inputcant.type = "number";
    } else {
        inputcant = document.createElement("span");
        inputcant.className = "infodata";
    }
    inputcant.id = id;
    lix.append(spantitle);
    lix.append(inputcant);
    donde.append(lix);
    return lix;
}

function findGetParameter(parameterName) {
    var result = null,
        tmp = [];
    location.search
        .substr(1)
        .split("&")
        .forEach(function (item) {
            tmp = item.split("=");
            if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
        });
    return result;
}

/* =================================================================
   Consola
   =================================================================
   Se abre y cierra con la tecla | (la de al lado del 1), estilo CS 1.6:
   baja desde arriba, translúcida, y responde aunque estés escribiendo
   dentro de un input.

   Evalúa cuentas con un parser propio — nada de eval(), que ejecutaría
   cualquier cosa que se escriba.
   ================================================================= */

let consolaHistorial = [];
let consolaPosHist = -1;
let consolaUltimo = 0;
let consolaFocoPrevio = null;

function consolaAbierta() {
    const c = document.getElementById("consola");
    return c != null && c.classList.contains("abierta");
}

/* La tecla al lado del 1: en latinoamericano da "|", en otros layouts
   da ` o º, pero siempre es la misma tecla física (Backquote). */
function esTeclaConsola(e) {
    if (e.metaKey) return false;
    if (e.key === "|") return true;
    if (e.ctrlKey || e.altKey) return false;
    return e.code === "Backquote";
}

// --- evaluador -----------------------------------------------------

function tokenizarExpresion(txt) {
    const tokens = [];
    const re = /\s*(\d+(?:[.,]\d+)?|[a-zA-Z]+|[()+\-*/%^]|\S)/g;
    let m;
    while ((m = re.exec(txt)) !== null) tokens.push(m[1]);
    return tokens;
}

function evaluarExpresion(txt) {
    const t = tokenizarExpresion(txt);
    let i = 0;

    const ver = function () { return t[i]; };
    const comer = function () { return t[i++]; };
    const esNumero = function (s) { return s != undefined && /^\d+(?:[.,]\d+)?$/.test(s); };

    function expr() {
        let v = term();
        while (ver() === "+" || ver() === "-") {
            const op = comer();
            const d = term();
            v = op === "+" ? v + d : v - d;
        }
        return v;
    }

    function term() {
        let v = unario();
        while (ver() === "*" || ver() === "/" || ver() === "%") {
            const op = comer();
            const d = unario();
            if ((op === "/" || op === "%") && d === 0) throw new Error("no se puede dividir por cero");
            v = op === "*" ? v * d : (op === "/" ? v / d : v % d);
        }
        return v;
    }

    function unario() {
        if (ver() === "-") { comer(); return -unario(); }
        if (ver() === "+") { comer(); return unario(); }
        return potencia();
    }

    function potencia() {
        const base = primario();
        if (ver() === "^") { comer(); return Math.pow(base, unario()); }  // 2^3^2 = 2^(3^2)
        return base;
    }

    function primario() {
        const s = ver();
        if (s == undefined) throw new Error("la cuenta termina antes de tiempo");
        if (s === "(") {
            comer();
            const v = expr();
            if (ver() !== ")") throw new Error("falta cerrar un paréntesis");
            comer();
            return v;
        }
        if (esNumero(s)) { comer(); return parseFloat(comaAPunto(s)); }
        if (/^[a-zA-Z]+$/.test(s)) {
            if (s.toLowerCase() === "ans") { comer(); return consolaUltimo; }
            throw new Error('no conozco "' + s + '"');
        }
        throw new Error('no entiendo "' + s + '"');
    }

    const r = expr();
    if (i < t.length) throw new Error('sobra "' + t.slice(i).join(" ") + '"');
    if (typeof r !== "number" || isNaN(r)) throw new Error("eso no da un número");
    if (!isFinite(r)) throw new Error("el resultado se fue al infinito");
    return r;
}

function comaAPunto(s) { return s.replace(",", "."); }

function formatearResultado(n) {
    /* 0.1 + 0.2 tiene que dar 0.3, no 0.30000000000000004 */
    const limpio = Math.round(n * 1e10) / 1e10;
    const plano = String(limpio);
    const entero = plano.split(".")[0].replace("-", "");
    if (entero.length > 4) {
        const partes = plano.split(".");
        const conMiles = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return plano + "   (" + conMiles + (partes[1] ? "," + partes[1] : "") + ")";
    }
    return plano;
}

// --- salida --------------------------------------------------------

function consolaEscribir(texto, clase) {
    const salida = document.getElementById("consola_salida");
    const linea = document.createElement("div");
    linea.className = "consola_linea_salida " + (clase || "");
    linea.innerText = texto;
    salida.append(linea);
    salida.scrollTop = salida.scrollHeight;
}

function consolaLimpiar() {
    document.getElementById("consola_salida").innerHTML = "";
}

function consolaAyuda() {
    consolaEscribir("Operadores:  +  -  *  /  %  ^  y paréntesis", "info");
    consolaEscribir("Decimales con punto o coma:  2.5  ·  2,5", "info");
    consolaEscribir("ans reutiliza el último resultado:  ans * 2", "info");
    consolaEscribir("Comandos:  help  ·  clear (o cls)", "info");
}

function consolaEjecutar(entrada) {
    const txt = entrada.trim();
    if (txt === "") return;

    consolaHistorial.push(txt);
    consolaPosHist = consolaHistorial.length;
    consolaEscribir("> " + txt, "eco");

    const cmd = txt.toLowerCase();
    if (cmd === "clear" || cmd === "cls") { consolaLimpiar(); return; }
    if (cmd === "help" || cmd === "ayuda" || cmd === "?") { consolaAyuda(); return; }

    try {
        const r = evaluarExpresion(txt);
        consolaUltimo = r;
        consolaEscribir("= " + formatearResultado(r), "resultado");
    } catch (err) {
        consolaEscribir("✗ " + err.message, "error");
    }
}

// --- abrir / cerrar ------------------------------------------------

function abrirConsola() {
    const c = document.getElementById("consola");
    const inp = document.getElementById("consola_input");
    consolaFocoPrevio = document.activeElement;
    c.classList.add("abierta");
    c.setAttribute("aria-hidden", "false");
    if (document.getElementById("consola_salida").children.length === 0) {
        consolaEscribir("Calculadora — escribí una cuenta y Enter. Ej: (40 * 3) / 2", "info");
    }
    inp.value = "";
    consolaPosHist = consolaHistorial.length;
    setTimeout(function () { inp.focus(); }, 30);
}

function cerrarConsola() {
    const c = document.getElementById("consola");
    c.classList.remove("abierta");
    c.setAttribute("aria-hidden", "true");
    document.getElementById("consola_input").blur();
    if (consolaFocoPrevio != null && document.contains(consolaFocoPrevio)) {
        try { consolaFocoPrevio.focus(); } catch (e) { }
    }
    consolaFocoPrevio = null;
}

function alternarConsola() {
    if (consolaAbierta()) cerrarConsola(); else abrirConsola();
}

function moverHistorial(dir) {
    if (consolaHistorial.length === 0) return;
    const inp = document.getElementById("consola_input");
    consolaPosHist += dir;
    if (consolaPosHist < 0) consolaPosHist = 0;
    if (consolaPosHist >= consolaHistorial.length) {
        consolaPosHist = consolaHistorial.length;
        inp.value = "";
        return;
    }
    inp.value = consolaHistorial[consolaPosHist];
    setTimeout(function () { inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);
}

function iniciarConsola() {
    const inp = document.getElementById("consola_input");

    /* en captura, así gana a los demás handlers y el "|" nunca llega al input
       que estés tipeando */
    document.addEventListener("keydown", function (e) {
        if (esTeclaConsola(e)) {
            e.preventDefault();
            e.stopPropagation();
            alternarConsola();
            return;
        }
        if (!consolaAbierta()) return;

        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cerrarConsola();
            return;
        }
        if (e.target !== inp) return;

        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            consolaEjecutar(inp.value);
            inp.value = "";
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            moverHistorial(-1);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            moverHistorial(1);
        }
    }, true);

    /* clic en el fondo de la consola = volver al input */
    document.getElementById("consola").addEventListener("mousedown", function (e) {
        if (e.target.id === "consola_input") return;
        e.preventDefault();
        inp.focus();
    });
}

let totalget;
document.addEventListener('keydown', function (event) {
    if (consolaAbierta()) return;   // con la consola abierta las flechas son del historial
    if (modoseleccion) {
        const lista_li_recetas = lista_recetas_ul.children;

        if (lista_li_recetas[anteriorseleccion] != undefined)
            lista_li_recetas[anteriorseleccion].className = "";

        if (event.key == "ArrowDown") {
            selectactual_recetas++;
        } else if (event.key == "ArrowUp") {
            selectactual_recetas--;
        } else if (event.key == "Enter") {
            let e = new Event("click");
            if (lista_li_recetas[selectactual_recetas] != undefined) {
                lista_li_recetas[selectactual_recetas].dispatchEvent(e);
                modoseleccion = false;
            }
        }
        anteriorseleccion = selectactual_recetas;
        if (lista_li_recetas[selectactual_recetas] != undefined) {
            lista_li_recetas[selectactual_recetas].className = "hover";
            lista_li_recetas[selectactual_recetas].scrollIntoView(false);
        }
        if (selectactual_recetas < 0) selectactual_recetas = lista_li_recetas.length;
        if (selectactual_recetas > lista_li_recetas.length) selectactual_recetas = -1;
    }
});

function seleccionarItem() {
    if (lista_recetas_ul.children[anteriorseleccion] != undefined)
        lista_recetas_ul.children[anteriorseleccion].className = "";
    if (lista_recetas_ul.children[selectactual_recetas] != undefined)
        lista_recetas_ul.children[selectactual_recetas].className = "";
    selectactual_recetas = this.contador;
    anteriorseleccion = selectactual_recetas;
    this.className = "hover";
}

function normalizarBusqueda(v) {
    v = v.toLowerCase();
    v = v.replace(/á/g, "a");
    v = v.replace(/é/g, "e");
    v = v.replace(/í/g, "i");
    v = v.replace(/ó/g, "o");
    v = v.replace(/ú/g, "u");
    v = v.replace(/b/g, "v");
    v = v.replace(/ /g, "");
    return v;
}

/* Cada entrada del buscador lleva su badge para distinguir de un vistazo
   una receta de alquimia de una de procesamiento. */
function crearItemLista(k, contador) {
    const nli = document.createElement("li");
    nli.id = k;
    nli.contador = contador;
    nli.innerText = rdata["datos"][k]["titulo"];
    nli.append(crearBadgeTipo(k));
    nli.addEventListener("click", setAndLoad);
    nli.addEventListener("mouseover", seleccionarItem);
    return nli;
}

let ratioget;
let ratioprocget;
window.addEventListener("load", function () {
    const buscador = document.getElementById("buscador");
    const lista_recetas = document.getElementById("lista_recetas");
    let idresget = findGetParameter("id");
    totalget = findGetParameter("t");
    ratioget = findGetParameter("r");
    ratioprocget = findGetParameter("rp");
    lista_recetas_ul = document.getElementById("lista_recetas");

    iniciarConsola();

    document.getElementById("tab_arbol").addEventListener("click", function () { cambiarVistaBase("arbol"); });
    document.getElementById("tab_puros").addEventListener("click", function () { cambiarVistaBase("puros"); });

    fetch("datosv1.json")
        .then(function (rep) {
            return rep.json()
        })
        .then(function (jj) {
            rdata = jj;
            lista_recetas.innerHTML = "";
            let ccc = 0;
            for (let k of Object.keys(rdata["datos"])) {
                if (esReceta(k)) {
                    lista_recetas.append(crearItemLista(k, ccc));
                    ccc++;
                }
            }
            if (idresget != null && rdata["datos"][idresget] != undefined) {
                let tempObj = { "id": idresget };
                tempObj.setAndLoad = setAndLoad;
                tempObj.setAndLoad();
            }
        });

    buscador.addEventListener("input", function () {
        lista_recetas.style = "display: block";
        let v = normalizarBusqueda(this.value);
        modoseleccion = true;
        if (lista_recetas_ul.children[selectactual_recetas] != undefined)
            lista_recetas_ul.children[selectactual_recetas].className = "";
        if (lista_recetas_ul.children[anteriorseleccion] != undefined)
            lista_recetas_ul.children[anteriorseleccion].className = "";
        selectactual_recetas = 0;
        anteriorseleccion = 0;

        lista_recetas.innerHTML = "";
        let ccc = 0;
        for (let k of Object.keys(rdata["datos"])) {
            const titulo = normalizarBusqueda(rdata["datos"][k]["titulo"]);
            if (titulo.includes(v) || v == "") {
                if (esReceta(k)) {
                    lista_recetas.append(crearItemLista(k, ccc));
                    ccc++;
                }
            }
        }
    });
    buscador.addEventListener("focus", function () {
        lista_recetas.style = "display: block";
        modoseleccion = true;
    });
});

window.onpopstate = function (event) {
    let idresget = findGetParameter("id");
    if (idresget == null || rdata["datos"][idresget] == undefined) return;
    let tempObj = { "id": idresget };
    tempObj.setAndLoad = setAndLoad;
    tempObj.setAndLoad();
}
