# BDO - Calculadora de Recetas de Alquimia

Calculadora de alquimia 100% client-side (Javascript ECMA6), hermana de la de cocina.

Además de las recetas de **Alquimia**, resuelve los ingredientes que sólo se obtienen
por **Procesamiento** (Alquimia Simple, Calentar, Secar, Moler, Filtrar, Sacudir),
cada uno con su propio ratio de rendimiento.

Datos: BDO SA (es-419), extraídos de bdocodex.

Perfume de Anhelo está disponible con su receta de Alquimia y su variante
de Alquimia Simple. Fuentes: [BDO Codex](https://bdocodex.com/sp/item/1411/)
y [notas oficiales de SA del 21/08/2025](https://www.sa.playblackdesert.com/es-MX/News/Detail?countryType=es-MX&groupContentNo=6639).

Los ingredientes puros incluyen métodos de obtención, detalles, fuentes y fecha
de verificación en `datosv1.json` → `datos` → `obtencion`. Se muestran varios
métodos cuando están verificados; no es una lista exhaustiva de recompensas o
eventos. Tienda NPC y Mercado Central son categorías distintas. El campo
«Precio de compra» de una ficha no demuestra que el ítem se venda en una tienda.
Los métodos corresponden al ingrediente mostrado, no a todos sus sustitutos.

«Guardar preferencias» está en el panel desplegable de preferencias generales.
«Guardar estado» está junto a la lista de ingredientes y conserva el avance de
cada receta. Los datos existentes en el almacenamiento local siguen siendo compatibles.

Doble clic en la cantidad amarilla de un ingrediente puro permite ajustar toda
la receta a esa cantidad disponible. Enter o salir del campo aplica; Escape
cancela. También se puede abrir el editor con Tab y Enter. Se calculan las
máximas elaboraciones completas posibles respetando los redondeos de cada
subreceta, y se conservan las cantidades ya conseguidas. Se aceptan enteros
como `1000` o `1.000`; si sobra material, se informa cuánto se utilizará.

En Ingredientes puros, «Filtro» permite incluir métodos con clic izquierdo y
excluirlos con clic derecho (o con el botón −). Repetir el mismo clic vuelve
al estado sin filtro. Alcanza con cumplir uno de los incluidos, pero no puede
tener ninguno de los excluidos. Sin métodos incluidos se aceptan todos salvo
los excluidos. «Ocultar los que no coinciden» alterna entre
ocultar y atenuar los ingredientes fuera del filtro, combinando los métodos
con la búsqueda por nombre. La selección se mantiene al recalcular y cambiar
de pestaña durante la sesión; no modifica cantidades ni el progreso global.

Pruebas de catálogo y cálculos: `node --test tests/recetas.test.cjs`.
Pruebas de navegador: `node tests/interfaz.cjs` (requiere Playwright y Chromium).
Se pueden configurar `PLAYWRIGHT_MODULE`, `CHROME_PATH` y `SCREENSHOT_DIR` para
usar una instalación existente y guardar capturas de escritorio/móvil.
