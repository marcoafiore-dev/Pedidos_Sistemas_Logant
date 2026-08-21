import { useState, useEffect } from 'react';

const SISTEMAS = ['SIOC', 'SISFA', 'SIVA', 'Las Violetas', 'GesIndu', 'Otro'];
const URGENCIAS = [
  { value: 'Baja', label: 'Baja (puede esperar)' },
  { value: 'Media', label: 'Media (preferiblemente pronto)' },
  { value: 'Alta', label: 'Alta (importante)' },
  { value: 'Critica', label: 'Crítica (urgente)' },
];
const AREAS = ['Administracion', 'Operaciones', 'Finanzas', 'Capital Humano', 'Sistemas', 'Comercial'];

const getUserName = () => {
  if (typeof window !== 'undefined' && window._spPageContextInfo) {
    if (window._spPageContextInfo.userEmail) {
      return window._spPageContextInfo.userEmail;
    }
    if (window._spPageContextInfo.userLoginName) {
      const loginName = window._spPageContextInfo.userLoginName.split('\\').pop();
      if (loginName) return loginName;
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
      if (stored) return stored;
    } catch (e) {}
  }

  if (typeof window !== 'undefined' && window._spUserInfo) {
    return window._spUserInfo.email || window._spUserInfo.name || 'Usuario Desconocido';
  }

  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    if (userParam && !userParam.startsWith('{') && userParam !== 'Usuario Desconocido') {
      return userParam;
    }
  }

  return 'Usuario Desconocido';
};

const initialState = {
  titulo: '',
  tipo: '',
  sistema: '',
  necesidad: '',
  mejora: '',
  impacto: '',
  urgencia: '',
  area: '',
  justificacion: '',
  fecha: '',
  solicitante: '',
  attachments: [],
};

export default function Home() {
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [closeBlocked, setCloseBlocked] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState('');

  useEffect(() => {
    setForm(prev => ({ ...prev, solicitante: '' }));
  }, []);

  const update = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'tipo' && value !== 'Mejora' ? { sistema: '' } : {}),
    }));
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) {
      setForm(prev => ({ ...prev, attachments: [] }));
      setErrorMsg('');
      return;
    }

    // Limitar a 2 archivos máximo
    if (files.length > 2) {
      setErrorMsg('Máximo 2 archivos permitidos');
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const newAttachments = [];
    setAttachmentProgress(`Procesando ${files.length} archivo(s)...`);
    setErrorMsg('');

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        setErrorMsg(`El archivo "${file.name}" excede 5MB (tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        setAttachmentProgress('');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        newAttachments.push({
          name: file.name,
          content: base64,
          size: file.size,
        });

        if (newAttachments.length === files.length) {
          setForm(prev => ({ ...prev, attachments: newAttachments }));
          setAttachmentProgress(`✓ ${newAttachments.length} archivo(s) listo(s)`);
          setTimeout(() => setAttachmentProgress(''), 2000);
        }
      };

      reader.onerror = () => {
        setErrorMsg(`Error al leer archivo "${file.name}"`);
        setAttachmentProgress('');
      };

      reader.readAsDataURL(file);
    }
  };

  const handleClose = () => {
    window.close();
    setTimeout(() => {
      setErrorMsg('');
      setStatus(null);
      setCloseBlocked(true);
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.titulo) return setErrorMsg('Por favor completa el título del requerimiento');
    if (!form.solicitante) return setErrorMsg('Por favor ingresa tu nombre y apellido como Solicitante');
    if (!form.tipo) return setErrorMsg('Por favor selecciona el tipo de solicitud');
    if (form.tipo === 'Mejora' && !form.sistema) return setErrorMsg('Por favor selecciona el sistema a mejorar');
    if (!form.necesidad) return setErrorMsg('Por favor completa el campo "¿Qué necesitas?"');
    if (!form.urgencia) return setErrorMsg('Por favor selecciona el nivel de urgencia');
    if (!form.justificacion) return setErrorMsg('Por favor completa la justificación');

    setStatus('sending');

    const payload = {
      formData: {
        Title: form.titulo,
        Tipo: form.tipo,
        Sistema: form.sistema || '',
        Necesidad: form.necesidad,
        MejoraEsperada: form.mejora,
        Impacto: form.impacto,
        Urgencia: form.urgencia,
        Areadenegocio: form.area || '',
        Justificacion: form.justificacion,
        Fechadeentregaesperada: form.fecha || null,
        Solicitante: form.solicitante,
        Estado: 'Nuevo',
      },
      attachments: form.attachments,
    };

    try {
      const res = await fetch('/api/createItem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error desconocido');
      }

      setStatus('success');
      setForm(initialState);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="header">
          <h1>📋 Pedidos de Sistemas</h1>
          <p>Solicita nuevos desarrollos o mejoras a sistemas existentes</p>
        </div>

        <form onSubmit={handleSubmit}>
          <section>
            <h2>1. Título del Requerimiento</h2>
            <label>Nombre del requerimiento *</label>
            <input
              type="text"
              placeholder="Ej: Mejora en reporte de stock, Nuevo módulo de facturación..."
              value={form.titulo}
              onChange={update('titulo')}
            />
            <small>Un nombre corto y descriptivo para identificar esta solicitud</small>
          </section>

          <section>
            <h2>2. Solicitante</h2>
            <label>Solicitante *</label>
            <input
              type="text"
              placeholder="Nombre Apellido"
              value={form.solicitante}
              onChange={update('solicitante')}
            />
            <small>Nombre y apellido. Esta persona será el punto focal contactado por Sistemas para avanzar en el relevamiento</small>
          </section>

          <section>
            <h2>3. Tipo de Solicitud</h2>
            <label>¿Qué tipo de solicitud es? *</label>
            <select value={form.tipo} onChange={update('tipo')}>
              <option value="">-- Seleccionar --</option>
              <option value="Desarrollo nuevo">Desarrollo nuevo</option>
              <option value="Mejora">Mejora a sistema existente</option>
            </select>

            {form.tipo === 'Mejora' && (
              <>
                <label>¿Cuál sistema deseas mejorar? *</label>
                <select value={form.sistema} onChange={update('sistema')}>
                  <option value="">-- Seleccionar --</option>
                  {SISTEMAS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </>
            )}
          </section>

          <section>
            <h2>4. Descripción de la Necesidad</h2>
            <label>¿Qué necesitas? *</label>
            <textarea
              placeholder="Describe el problema o necesidad con el mayor detalle posible"
              value={form.necesidad}
              onChange={update('necesidad')}
            />
            <small>Sé específico: ¿qué no funciona? ¿qué proceso es difícil? ¿qué información falta?</small>

            <div className="grid2">
              <div>
                <label>Mejora esperada</label>
                <textarea
                  placeholder="Describe cómo debería funcionar idealmente"
                  value={form.mejora}
                  onChange={update('mejora')}
                />
                <small>¿Cuál sería la solución perfecta?</small>
              </div>
              <div>
                <label>¿Cómo impacta en tu trabajo?</label>
                <textarea
                  placeholder="Eficiencia, productividad, calidad, tiempo..."
                  value={form.impacto}
                  onChange={update('impacto')}
                />
                <small>¿Qué mejorarías con esto?</small>
              </div>
            </div>
          </section>

          <section>
            <h2>5. Prioridad y Contexto</h2>
            <div className="grid2">
              <div>
                <label>Nivel de urgencia *</label>
                <select value={form.urgencia} onChange={update('urgencia')}>
                  <option value="">-- Seleccionar --</option>
                  {URGENCIAS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Área de negocio</label>
                <select value={form.area} onChange={update('area')}>
                  <option value="">-- Seleccionar --</option>
                  {AREAS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <label>¿Por qué ese nivel de urgencia? *</label>
            <textarea
              placeholder="Explica los motivos y cualquier contexto importante"
              value={form.justificacion}
              onChange={update('justificacion')}
            />
            <small>Ejemplo: Afecta a 5 usuarios, retrasa entrega de cliente, bloquea proceso crítico...</small>
          </section>

          <section>
            <h2>6. Cronograma (Opcional)</h2>
            <label>¿Para cuándo la necesitas?</label>
            <input type="date" value={form.fecha} onChange={update('fecha')} />
            <small>Fecha deseada de disponibilidad</small>
          </section>

          <section>
            <h2>7. Adjuntos (Opcional)</h2>
            <label>Archivos adjuntos (máximo 2 archivos, 5MB cada uno)</label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.txt"
              onChange={handleFileChange}
              disabled={status === 'sending'}
            />
            <small>Podés adjuntar capturas de pantalla, documentos, especificaciones, etc.</small>
            {form.attachments.length > 0 && (
              <div className="attachments-list">
                <strong>Archivos adjuntos ({form.attachments.length}):</strong>
                <ul>
                  {form.attachments.map((att, idx) => (
                    <li key={idx}>
                      {att.name} ({(att.size / 1024 / 1024).toFixed(2)}MB)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {attachmentProgress && (
              <small className="progress">{attachmentProgress}</small>
            )}
          </section>

          {closeBlocked && (
            <div className="msg info">Ya podés cerrar esta pestaña o ventana.</div>
          )}
          {status === 'success' && (
            <div className="msg success">✓ Solicitud enviada exitosamente. Será revisada por el equipo de sistemas.</div>
          )}
          {(status === 'error' || errorMsg) && (
            <div className="msg error">✗ {errorMsg || 'Error al enviar la solicitud. Por favor, intenta nuevamente.'}</div>
          )}

          <div className="actions">
            <button type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
            <button type="button" className="secondary" onClick={handleClose}>
              Cerrar
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          padding: 40px 16px;
          background: linear-gradient(180deg, #eef1f8 0%, #dfe4f0 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .card {
          width: 100%;
          max-width: 800px;
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(30, 58, 138, 0.15);
          height: fit-content;
        }
        .header {
          background: #1e3a8a;
          color: #fff;
          padding: 32px;
          text-align: center;
        }
        .header h1 { margin: 0 0 8px; font-size: 26px; }
        .header p { margin: 0; opacity: 0.85; }
        form { padding: 32px; }
        section { margin-bottom: 28px; }
        h2 {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #1e3a8a;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
          margin-bottom: 16px;
        }
        label {
          display: block;
          font-weight: 600;
          font-size: 14px;
          margin: 14px 0 6px;
          color: #1f2937;
        }
        select, textarea, input[type="date"], input[type="text"], input[type="file"] {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          box-sizing: border-box;
        }
        input[type="file"] {
          padding: 8px;
        }
        input[type="file"]:disabled {
          background-color: #f3f4f6;
          cursor: not-allowed;
        }
        textarea { min-height: 80px; resize: vertical; }
        small { display: block; color: #6b7280; margin-top: 4px; font-size: 12px; }
        small.progress { color: #059669; font-weight: 600; }
        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 600px) {
          .grid2 { grid-template-columns: 1fr; }
        }
        .attachments-list {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 12px;
          margin-top: 12px;
        }
        .attachments-list strong {
          color: #065f46;
          font-size: 13px;
        }
        .attachments-list ul {
          list-style: none;
          padding: 8px 0 0;
          margin: 0;
        }
        .attachments-list li {
          color: #047857;
          font-size: 13px;
          padding: 4px 0;
          margin-left: 12px;
        }
        .msg {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
        }
        .msg.success { background: #d1fae5; color: #065f46; }
        .msg.error { background: #fee2e2; color: #991b1b; }
        .msg.info { background: #dbeafe; color: #1e40af; }
        .actions { display: flex; gap: 12px; }
        button {
          flex: 1;
          padding: 14px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
        }
        button[type="submit"] { background: #1e3a8a; color: #fff; }
        button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
        button.secondary { background: #f3f4f6; color: #374151; }
      `}</style>
    </div>
  );
}
