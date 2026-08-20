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

function crearMarcaGrupo() {
    const m = document.createElement("span");
    m.className = "marca_grupo";
    m.innerText = "↻";
    m.title = "Sustituible por cualquier ítem de su grupo";
    return m;
}

/* La lista de ingredientes base tiene dos vistas: el árbol anidado y la lista
   plana de ingredientes puros (los que no salen ni de alquimia ni de
   procesamiento: se compran o se recolectan). */
let vistaBaseActual = "arbol";

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

/* Lista plana con lo que hay que conseguir de verdad: las hojas del árbol,
   es decir todo lo que NO es una receta (ni de alquimia ni de procesamiento).
   Las cantidades son los totales ya acumulados de todas las ramas. */
function crearListaPuros(totalesGlobales) {
    const ul = document.createElement("ul");
    ul.className = "lista_puros";

    const puros = Object.keys(totalesGlobales)
        .filter(k => !esReceta(k))
        .sort((a, b) => rdata["datos"][a]["titulo"].localeCompare(rdata["datos"][b]["titulo"], "es"));

    for (let k of puros) {
        const li = document.createElement("li");
        li.className = "ingrediente_puro";

        const span_contenedor = document.createElement("span");
        span_contenedor.className = "ing_contenedor";

        const span_titulo = document.createElement("span");
        span_titulo.className = "ing_titulo_ingrediente";
        span_titulo.innerHTML = `<span class="titing">${rdata["datos"][k]["titulo"]}</span>`;

        span_contenedor.append(span_titulo);
        span_contenedor.append(crearSpanCantidad(Math.ceil(totalesGlobales[k]), 0));
        if (rdata["datos"][k]["grupo"])
            span_contenedor.append(crearMarcaGrupo());

        li.append(span_contenedor);
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
    acumularTotalesArbol(currentingrediente, cantidad, 0, totalesGlobales);

    const ul = crearArbolIngredientes(currentingrediente, cantidad, 0, totalesGlobales);
    ulingredientes.append(ul);

    /* las dos vistas se arman juntas y se muestra la que esté activa */
    const puros = crearListaPuros(totalesGlobales);
    ulpuros.append(puros.ul);
    document.getElementById("tab_puros").innerText = "Ingredientes puros (" + puros.cantidad + ")";

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

function acumularTotalesArbol(recetaId, cantidad, nivel, totalesGlobales) {
    const ingredientes = ingredientesDe(recetaId);
    const keysLista = Object.keys(ingredientes).sort();
    const veces = elaboracionesNecesarias(recetaId, cantidad, nivel);

    for (let ingId of keysLista) {
        const cantidad_ing = Math.ceil(veces * ingredientes[ingId]);
        if (!totalesGlobales[ingId]) {
            totalesGlobales[ingId] = 0;
        }
        totalesGlobales[ingId] += cantidad_ing;

        if (esReceta(ingId)) {
            acumularTotalesArbol(ingId, cantidad_ing, nivel + 1, totalesGlobales);
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
            if (rdata["datos"][ingId]["grupo"])
                span_contenedor.append(crearMarcaGrupo());
            li.append(span_contenedor);
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

function calcPrct(total, usado) {
    if (total != 0 || total != undefined) {
        return (usado * 100) / total > 100 ? 100 : (usado * 100) / total;
    }
    return 0;
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
    const pmax = document.getElementById("pesomax").value;
    const pmio = document.getElementById("mipeso").value;

    const bocupado = document.getElementById("bocupado");
    const busado = document.getElementById("busado");

    let pocupado = calcPrct(pmax, pmio);
    let pusado = calcPrct(pmax, gpeso);
    const resultado = Math.round(((parseFloat(pmio) + parseFloat(gpeso)) + Number.EPSILON) * 100) / 100;

    const pocup = document.getElementById("pesoocu")
    const pomax = document.getElementById("pesotot");
    pocup.innerText = "" + resultado;
    pomax.innerText = "/ " + pmax + " LT";

    if ((pmax - resultado) < 50)
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
}

function setAndLoad() {
    gastoIngCalculados = {};
    modoseleccion = false;
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
        lix.append(spantitle);

        /* El badge dice de dónde sale este ingrediente: alquimia, alquimia
           simple o procesamiento. La marca ↻ dice que acepta su grupo. */
        if (isLink)
            lix.append(crearBadgeTipo(ird));
        if (rdata["datos"][ird]["grupo"])
            lix.append(crearMarcaGrupo());

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
        ilista.append(lix);
    }

    const prefs = leerPreferencias();
    const rAlq = prefs["ratio"] != undefined ? prefs["ratio"] : 2.5;
    const rProc = prefs["ratio_proc"] != undefined ? prefs["ratio_proc"] : 2.5;

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

    let ratio = crearElementoLi(otros,
        grupo == "alquimia" ? "Ratio de Alquimia: " : "Ratio de Alquimia (sub-recetas): ", "ratio");
    ratio.classList.add("ratio_txt");
    ratio.children[1].value = rAlq;
    ratio.children[1].step = 0.1;
    ratio.children[1].addEventListener("input",
        grupo == "alquimia" ? modificarSegunRatio : generarListaIngredientesSiHay);

    let ratio_proc = crearElementoLi(otros,
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
    botonsave.onclick = guardarPreferencias;

    boton.innerText = "Calcular Ingredientes";
    boton.addEventListener("click", generarListaIngredientes);
    nli.append(boton);
    nli.append(botonsave);

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
    otros.append(divpeso);

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
        let pmax = document.getElementById("pesomax").value;
        let pmio = document.getElementById("mipeso").value;

        if (pmax == "") pmax = 0;
        if (pmio == "") pmio = 0;

        const disponible = pmax - pmio;

        let pesodata = 0;
        for (let ingx of inglist) {
            let inputcocic = document.getElementById(ingx + "_cant");
            const ddato = 1 * Math.ceil(inputcocic.bdocant / calidad_ing[calidades[inputcocic.bdogrado]]);
            pesodata += parseFloat(rdata["datos"][ingx]["peso"]) * ddato;
        }
        const resultado = Math.floor((disponible / pesodata) * 0.95);

        const tinput = document.getElementById("cantidad");
        tinput.value = resultado;
        let e = new Event("input");
        tinput.dispatchEvent(e);
    }
    infopesox.append(spaninfpoc);
    infopesox.append(spaninfpto);
    infopesox.append(fbutton);

    ppeso.children[1].innerText = "LT 0.00";
    otros.append(nli);
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

    secondLoad = true;
}

function generarListaIngredientesSiHay() {
    if (document.querySelector("#ingredientes_base .ingrediente_item") != null)
        generarListaIngredientes();
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

let totalget;
document.addEventListener('keydown', function (event) {
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
