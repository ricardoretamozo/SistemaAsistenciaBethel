// app.js - Lógica principal del Frontend (Eventos Recurrentes)

const API_URL = '/api';

// Utilidades de Fechas
function getTodayString() {
    const d = new Date();
    // Ajuste de zona horaria local
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(y, m-1, d);
    return dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Convertir de "2024-W15" a { start, end } en YYYY-MM-DD
function getWeekDates(weekString) {
    if(!weekString) return null;
    const [year, weekPart] = weekString.split('-W');
    const w = parseInt(weekPart, 10);
    const y = parseInt(year, 10);
    
    // Obtener el 1 de enero
    const simple = new Date(y, 0, 1);
    const days = (w - 1) * 7;
    const dayOffset = simple.getDay() <= 4 ? simple.getDay() - 1 : simple.getDay() - 8;
    
    const monday = new Date(simple.getFullYear(), 0, 1 - dayOffset + days);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    // Formato
    const format = (d) => {
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    return { start: format(monday), end: format(sunday), mondayObj: monday, sundayObj: sunday };
}

const app = {
    // Estado local
    miembros: [],
    eventosFijos: [],
    asistenciaActual: {}, 
    eventoFijoSeleccionado: null,
    fechaAsistencia: getTodayString(),

    // Inicialización
    init() {
        this.mostrarFechaEstatica();
        this.cargarEventosFijos().then(() => {
            this.renderTarjetasEventosHoy();
        });
        this.cargarMiembros();
        this.setupEventListeners();
        
        this.showTab('asistencia');
    },

    mostrarFechaEstatica() {
         const display = document.getElementById('fecha-hoy-display');
         if(display) {
             const str = formatDisplayDate(this.fechaAsistencia);
             // Capitalizar primera letra
             display.textContent = "⛪ Hoy es " + str.charAt(0).toUpperCase() + str.slice(1);
         }
    },

    setupEventListeners() {
        const inputSemana = document.getElementById('input-semana-reporte');
        if (inputSemana) {
            inputSemana.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.generarReporteSemanal(e.target.value);
                } else {
                    document.getElementById('reporte-empty').classList.remove('hidden');
                    document.getElementById('reporte-datos').classList.add('hidden');
                }
            });
        }
    },

    // UI: Navegación por Pestañas
    showTab(tabId) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

        document.getElementById(`view-${tabId}`).classList.remove('hidden');
        document.getElementById(`tab-${tabId}`).classList.add('active');
    },

    // UI: Alertas
    showAlert(message, type = 'success') {
        const container = document.getElementById('alert-container');
        const alertBox = document.createElement('div');
        
        const bgColor = type === 'success' ? 'bg-emerald-50' : 'bg-red-50';
        const borderColor = type === 'success' ? 'border-emerald-200' : 'border-red-200';
        const textColor = type === 'success' ? 'text-emerald-800' : 'text-red-800';
        const icon = type === 'success' ? '<i class="fa-solid fa-check-circle text-emerald-500"></i>' : '<i class="fa-solid fa-circle-exclamation text-red-500"></i>';

        alertBox.className = `flex items-center gap-3 p-4 mb-2 rounded-lg border ${bgColor} ${borderColor} ${textColor} shadow-sm animate-[fadeIn_0.3s_ease-out]`;
        alertBox.innerHTML = `${icon} <span class="font-medium">${message}</span>`;
        
        container.appendChild(alertBox);

        setTimeout(() => {
            alertBox.style.opacity = '0';
            alertBox.style.transition = 'opacity 0.5s';
            setTimeout(() => alertBox.remove(), 500);
        }, 3000);
    },

    // API: Miembros
    async cargarMiembros() {
        try {
            const res = await fetch(`${API_URL}/miembros`);
            this.miembros = await res.json();
            this.renderMiembros();
            if(this.eventoFijoSeleccionado) this.renderAsistenciaTable();
        } catch (error) {
            console.error('Error cargando miembros:', error);
            this.showAlert('Error al cargar la lista de miembros', 'error');
        }
    },

    async guardarMiembro(e) {
        e.preventDefault();
        const nombreInput = document.getElementById('miembro-nombre');
        const apellidoInput = document.getElementById('miembro-apellido');
        
        try {
            const res = await fetch(`${API_URL}/miembros`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nombreInput.value.trim(), apellido: apellidoInput.value.trim() })
            });

            if (res.ok) {
                this.showAlert('Miembro agregado correctamente');
                nombreInput.value = '';
                apellidoInput.value = '';
                this.cargarMiembros();
            }
        } catch (error) {
            this.showAlert('Error al guardar', 'error');
        }
    },

    renderMiembros() {
        const ul = document.getElementById('lista-miembros');
        if(!ul) return;
        ul.innerHTML = '';
        
        if (this.miembros.length === 0) {
            ul.innerHTML = `<li class="p-6 text-center text-gray-500">No hay miembros registrados.</li>`;
            return;
        }

        this.miembros.forEach(m => {
            const li = document.createElement('li');
            li.className = 'p-4 hover:bg-gray-50 transition-colors flex items-center';
            li.innerHTML = `
                <div class="h-10 w-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold mr-4">
                    ${m.nombre.charAt(0)}${m.apellido.charAt(0)}
                </div>
                <div>
                    <p class="font-medium text-gray-800">${m.apellido}, ${m.nombre}</p>
                    <p class="text-xs text-gray-400">ID: ${m.id.toString().padStart(3, '0')}</p>
                </div>
            `;
            ul.appendChild(li);
        });
    },

    // API: Eventos Fijos
    async cargarEventosFijos() {
        try {
            const res = await fetch(`${API_URL}/eventos_fijos`);
            this.eventosFijos = await res.json();
        } catch (error) {
            console.error('Error cargando eventos fijos:', error);
        }
    },

    renderTarjetasEventosHoy() {
        const container = document.getElementById('eventos-hoy-container');
        if(!container) return;
        
        container.innerHTML = '';
        
        const [y, m, d] = this.fechaAsistencia.split('-');
        const dateObj = new Date(y, m-1, d);
        const hoyDiaSemana = dateObj.getDay();

        // Filtrar eventos fijos configurados para hoy
        const eventosHoy = this.eventosFijos.filter(e => e.dia_semana === hoyDiaSemana);

        if (eventosHoy.length === 0) {
            container.innerHTML = `<div class="col-span-full p-4 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg"><i class="fa-solid fa-info-circle mr-2"></i> No hay cultos o eventos programados fijamente para hoy en el sistema estructural.</div>`;
            return;
        }

        eventosHoy.forEach(e => {
            const isSelected = this.eventoFijoSeleccionado === e.id;
            const btn = document.createElement('button');
            
            let extraClasses = isSelected ? 'bg-brand-600 text-white ring-4 ring-brand-200 shadow-lg scale-105' : 'bg-white text-gray-700 hover:border-brand-300 hover:shadow-md';
            if(!isSelected) btn.classList.add('border', 'border-gray-200');
            
            btn.className += ` w-full text-left p-5 rounded-xl transition-all transform duration-200 ${extraClasses}`;
            
            // Icono dependiendo del tipo (rudimentario)
            let icon = 'fa-calendar-check';
            let iconColor = isSelected ? 'text-white' : 'text-brand-500';
            let bgCircle = isSelected ? 'bg-white/20' : 'bg-brand-50';
            
            if(e.nombre.toLowerCase().includes('ayuno')) icon = 'fa-hands-praying';
            if(e.nombre.toLowerCase().includes('cena')) icon = 'fa-wine-glass';

            btn.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-full ${bgCircle} ${iconColor} flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-lg leading-tight mb-1">${e.nombre}</h4>
                        <span class="text-xs uppercase font-medium tracking-wider opacity-80">Tocar para abrir</span>
                    </div>
                </div>
            `;
            
            btn.onclick = () => {
                this.seleccionarEventoParaAsistencia(e.id, e.nombre);
            };

            container.appendChild(btn);
        });
    },

    seleccionarEventoParaAsistencia(eventoFijoId, nombre) {
        this.eventoFijoSeleccionado = eventoFijoId;
        this.renderTarjetasEventosHoy(); // Re-render targetas para marcar seleccionado

        document.getElementById('asistencia-empty-state').classList.add('hidden');
        document.getElementById('asistencia-table-container').classList.remove('hidden');
        document.getElementById('titulo-evento-seleccionado').textContent = nombre;
        
        this.cargarAsistenciaParaEvento();
    },

    // API y Lógica: Asistencia
    async cargarAsistenciaParaEvento() {
        if (!this.eventoFijoSeleccionado) return;
        try {
            const res = await fetch(`${API_URL}/asistencia/${this.eventoFijoSeleccionado}/${this.fechaAsistencia}`);
            const registros = await res.json();
            
            this.asistenciaActual = {};
            registros.forEach(reg => {
                if (reg.tipo_registro) {
                    this.asistenciaActual[reg.miembro_id] = {
                        tipo_registro: reg.tipo_registro,
                        firma_base64: reg.firma_base64
                    };
                }
            });

            this.renderAsistenciaTable();
        } catch (error) {
            console.error('Error cargando asistencia', error);
            this.showAlert('Error al cargar la tabla de asistencia', 'error');
        }
    },

    renderAsistenciaTable() {
        if (!this.eventoFijoSeleccionado) return;

        const tbody = document.getElementById('tbody-asistencia');
        tbody.innerHTML = '';
        
        document.getElementById('asistencia-count').textContent = this.miembros.length;

        if (this.miembros.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-gray-500">No hay miembros registrados. Añade miembros primero.</td></tr>`;
            return;
        }

        this.miembros.forEach((m, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors group';
            
            const registro = this.asistenciaActual[m.id];
            
            let htmlAccion = '';
            
            if (!registro) {
                // Estado: Ausente
                htmlAccion = `
                    <div class="flex justify-center items-center gap-2">
                        <button onclick="app.setAspa(${m.id})" title="Marcar con Aspa (Presente)" class="w-10 h-10 rounded-full border border-gray-300 text-gray-400 hover:text-white hover:bg-emerald-500 hover:border-emerald-500 transition-all flex items-center justify-center">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button onclick="signaturePad.open(${m.id}, '${m.nombre} ${m.apellido}')" title="Firmar (Presente)" class="w-10 h-10 rounded-full border border-gray-300 text-gray-400 hover:text-white hover:bg-brand-500 hover:border-brand-500 transition-all flex items-center justify-center">
                            <i class="fa-solid fa-pen-nib"></i>
                        </button>
                    </div>
                `;
            } else if (registro.tipo_registro === 'aspa') {
                htmlAccion = `
                    <div class="flex justify-center items-center gap-2">
                        <button onclick="app.removeAsistencia(${m.id})" title="Quitar Asistencia" class="w-10 h-10 rounded-full bg-emerald-500 text-white shadow-md flex items-center justify-center">
                            <i class="fa-solid fa-check"></i>
                        </button>
                    </div>
                `;
            } else if (registro.tipo_registro === 'firma') {
                htmlAccion = `
                    <div class="flex justify-center items-center gap-2">
                        <img src="${registro.firma_base64}" class="signature-img-preview border border-gray-200" title="Firma Registrada">
                        <button onclick="app.removeAsistencia(${m.id})" title="Borrar Firma" class="w-8 h-8 rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                             <i class="fa-solid fa-trash-alt text-xs"></i>
                        </button>
                    </div>
                `;
            }

            tr.innerHTML = `
                <td class="p-4 text-center text-gray-500 font-medium">${index + 1}</td>
                <td class="p-4">
                    <span class="font-medium text-gray-800">${m.apellido}</span>, <span class="text-gray-600">${m.nombre}</span>
                </td>
                <td class="p-4">
                    ${htmlAccion}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    setAspa(miembroId) {
        this.asistenciaActual[miembroId] = { tipo_registro: 'aspa', firma_base64: null };
        this.renderAsistenciaTable();
    },

    setFirma(miembroId, base64) {
        this.asistenciaActual[miembroId] = { tipo_registro: 'firma', firma_base64: base64 };
        this.renderAsistenciaTable();
    },

    removeAsistencia(miembroId) {
        delete this.asistenciaActual[miembroId];
        this.renderAsistenciaTable();
    },

    async guardarAsistencia() {
        if (!this.eventoFijoSeleccionado) return;

        const registrosArray = Object.keys(this.asistenciaActual).map(miembroId => {
            return {
                miembro_id: parseInt(miembroId),
                tipo_registro: this.asistenciaActual[miembroId].tipo_registro,
                firma_base64: this.asistenciaActual[miembroId].firma_base64
            };
        });

        try {
            const res = await fetch(`${API_URL}/asistencia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    evento_fijo_id: this.eventoFijoSeleccionado,
                    fecha: this.fechaAsistencia,
                    registros: registrosArray
                })
            });

            if (res.ok) {
                this.showAlert('Registro de asistencia guardado exitosamente.');
                this.cargarAsistenciaParaEvento();
            }
        } catch (error) {
            console.error(error);
            this.showAlert('Error al procesar la asistencia', 'error');
        }
    },

    // Reportes Semanales
    refreshReporte() {
        const input = document.getElementById('input-semana-reporte');
        if (input && input.value) {
            this.generarReporteSemanal(input.value);
            this.showAlert('Reporte actualizado', 'success');
        } else {
            this.showAlert('Seleccione una semana primero', 'error');
        }
    },

    async generarReporteSemanal(weekString) {
        const range = getWeekDates(weekString);
        if (!range) return;

        document.getElementById('reporte-empty').classList.add('hidden');
        document.getElementById('reporte-datos').classList.remove('hidden');

        document.getElementById('reporte-rango-semana').textContent = 
            `Del ${range.mondayObj.toLocaleDateString('es-ES')} al ${range.sundayObj.toLocaleDateString('es-ES')}`;

        try {
            const res = await fetch(`${API_URL}/reportes/semana?fecha_inicio=${range.start}&fecha_fin=${range.end}`);
            const data = await res.json(); // Array plano de asistencias

            // Encontrar qué eventos realmente ocurrieron (tienen al menos 1 asistencia) para ser columnas
            // Si queremos mostrar TODOS los posibles, podríamos generar columnas para cada dia x cada eventoFijo
            // Pero es más limpio mostrar solo los que tuvieron asistencia.
            const columnasSet = new Set();
            const columnasConfig = []; // { key, titulo }

            data.forEach(row => {
                const colKey = `${row.fecha}_${row.evento_fijo_id}`;
                if (!columnasSet.has(colKey)) {
                    columnasSet.add(colKey);
                    
                    const [y, m, d] = row.fecha.split('-');
                    const objFecha = new Date(y, m-1, d);
                    const nameDay = objFecha.toLocaleDateString('es-ES', { weekday: 'short' });
                    
                    columnasConfig.push({
                        key: colKey,
                        fecha: row.fecha,
                        fijoId: row.evento_fijo_id,
                        tituloHTML: `
                            <div class="flex flex-col text-center uppercase tracking-wide text-xs">
                                <span>${row.evento_nombre}</span>
                                <span class="font-normal opacity-75">${nameDay} ${d}</span>
                            </div>
                        `
                    });
                }
            });

            // Ordenar columnas por fecha
            columnasConfig.sort((a,b) => a.fecha.localeCompare(b.fecha));

            // Generar Thead
            const thead = document.getElementById('thead-reporte');
            let theadHTML = `
                <th class="border border-gray-300 p-2 text-center w-12 sticky left-0 bg-gray-100 z-10 shadow-[1px_0_0_gray]">N°</th>
                <th class="border border-gray-300 p-2 sticky left-12 bg-gray-100 z-10 shadow-[1px_0_0_gray] min-w-[200px]">Apellidos y Nombres</th>
            `;
            
            if (columnasConfig.length === 0) {
                theadHTML += `<th class="border border-gray-300 p-2 font-normal text-center text-gray-500">Sin registros en esta semana</th>`;
            } else {
                columnasConfig.forEach(c => {
                    theadHTML += `<th class="border border-gray-300 p-2 w-32 bg-brand-50 print:bg-gray-100 align-bottom">${c.tituloHTML}</th>`;
                });
            }
            thead.innerHTML = theadHTML;

            // Agrupar datos por miembro
            const mapMiembros = {}; // id -> { dataMiembro, asistencias: { colKey: tipo } }
            this.miembros.forEach(m => {
                mapMiembros[m.id] = { obj: m, asis: {} };
            });

            data.forEach(row => {
                const colKey = `${row.fecha}_${row.evento_fijo_id}`;
                if (mapMiembros[row.miembro_id]) {
                    mapMiembros[row.miembro_id].asis[colKey] = row.tipo_registro;
                }
            });

            // Generar Tbody
            const tbody = document.getElementById('tbody-reporte');
            tbody.innerHTML = '';

            this.miembros.forEach((m, idx) => {
                const asisMapa = mapMiembros[m.id].asis;
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 print:bg-white";

                let htmlTR = `
                    <td class="border border-gray-300 p-2 text-center text-sm sticky left-0 bg-white z-0 shadow-[1px_0_0_#d1d5db]">${idx + 1}</td>
                    <td class="border border-gray-300 p-2 text-sm uppercase sticky left-12 bg-white z-0 shadow-[1px_0_0_#d1d5db]">
                        ${m.apellido}, ${m.nombre}
                    </td>
                `;

                if (columnasConfig.length === 0) {
                    htmlTR += `<td class="border border-gray-300 p-2 text-center bg-gray-50">-</td>`;
                } else {
                    let asisTotal = 0;
                    columnasConfig.forEach(c => {
                        const tipoRegistro = asisMapa[c.key];
                        if (tipoRegistro) {
                            htmlTR += `<td class="border border-gray-300 p-2 text-center font-bold text-lg text-emerald-600 print:text-black">X</td>`;
                            asisTotal++;
                        } else {
                            htmlTR += `<td class="border border-gray-300 p-2 text-center text-gray-200 print:text-white">-</td>`;
                        }
                    });
                    
                    // Solo marcar rojo si faltó a TODO en la semana o algún evento (opcional, dejamos background suave)
                    if (asisTotal === 0) {
                        tr.classList.add('bg-red-50/50');
                    }
                }

                tr.innerHTML = htmlTR;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error('Error generando reporte semanal:', error);
            this.showAlert('Error al generar la matriz semanal', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
