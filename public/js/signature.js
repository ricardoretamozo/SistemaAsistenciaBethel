// signature.js - Lógica del pad de firmas usando Canvas API

const signaturePad = {
    modal: null,
    canvas: null,
    ctx: null,
    isDrawing: false,
    miembroIdActual: null,
    placeholder: null,
    hasSignature: false,

    init() {
        this.modal = document.getElementById('signature-modal');
        this.canvas = document.getElementById('signature-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.placeholder = document.getElementById('signature-placeholder');

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Eventos de Mouse
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

        // Eventos Touch (Mobile)
        this.canvas.addEventListener('touchstart', this.handleTouch.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouch.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));
    },

    resizeCanvas() {
        // Hacemos que la resolución interna del canvas coincida con la real para evitar trazos borrosos
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Estilos del trazo
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#1e293b'; // slate-800
    },

    open(miembroId, miembroNombre) {
        this.miembroIdActual = miembroId;
        document.getElementById('signature-miembro-nombre').textContent = `Firmando asistencia de: ${miembroNombre}`;
        
        this.clear(); // Limpiar lienzo al abrir
        this.modal.classList.remove('hidden');
        
        // Timeout para la animación de entrada
        setTimeout(() => {
            this.modal.classList.remove('opacity-0');
            document.getElementById('signature-modal-content').classList.remove('scale-95');
            this.resizeCanvas(); // Asegurar tamaño después de mostrar el modal
        }, 10);
    },

    close() {
        this.modal.classList.add('opacity-0');
        document.getElementById('signature-modal-content').classList.add('scale-95');
        
        // Ocultar después de la transición
        setTimeout(() => {
            this.modal.classList.add('hidden');
            this.miembroIdActual = null;
        }, 300);
    },

    startDrawing(e) {
        this.isDrawing = true;
        this.hasSignature = true;
        this.placeholder.style.display = 'none'; // Ocultar texto "Firme aquí"
        this.draw(e);
    },

    stopDrawing() {
        this.isDrawing = false;
        this.ctx.beginPath(); // Resetea el trazo para que la próxima línea no se conecte con la anterior
    },

    draw(e) {
        if (!this.isDrawing) return;

        // Prevenir comportamiento por defecto (ej. scroll en táctil)
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        let x, y;

        // Soporte para Mouse o Touch
        if (e.type.includes('touch')) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }

        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    },

    handleTouch(e) {
        if (e.type === 'touchstart') {
            this.startDrawing(e);
        } else if (e.type === 'touchmove') {
            this.draw(e);
        }
    },

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.hasSignature = false;
        this.placeholder.style.display = 'flex';
        this.ctx.beginPath();
    },

    save() {
        if (!this.hasSignature) {
            app.showAlert('Por favor, realiza una firma antes de guardar.', 'error');
            return;
        }

        const dataUrl = this.canvas.toDataURL('image/png');
        
        // Enviar la firma a la tabla principal
        app.setFirma(this.miembroIdActual, dataUrl);
        
        this.close();
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    signaturePad.init();
});
