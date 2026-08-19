export default async function handler(req, res) {
  // Solo POST, solo si viene con un token de seguridad
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Token simple de seguridad (cambiar después de usar)
  const SECURITY_TOKEN = 'migrate-planner-2026';
  if (req.body?.token !== SECURITY_TOKEN) {
    return res.status(401).json({ error: 'Token inválido o faltante' });
  }

  try {
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      return res.status(500).json({ error: 'Faltan variables de entorno' });
    }

    // Obtener token
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('grant_type', 'client_credentials');

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'No se pudo obtener token' });
    }

    const token = tokenData.access_token;
    const LIST_ID = '8f827ea8-c522-4d25-af7b-ddd936effa1c';
    const SITE_ID = 'logisticaantartica.sharepoint.com,d2f75beb-7dd9-4b76-a33b-52673e6b203d,8dea5ebc-e52c-41e4-921c-a02843dba293';
    const PLAN_ID = 'ekFDOut6PU6ODY-adkcGCWQABrRz';

    // Obtener items de SharePoint
    const itemsRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items?$expand=fields`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!itemsRes.ok) {
      return res.status(500).json({ error: 'Error obteniendo items de SharePoint' });
    }

    const itemsData = await itemsRes.json();
    const items = itemsData.value || [];

    // Obtener bucket "Pendiente"
    const bucketsRes = await fetch(
      `https://graph.microsoft.com/v1.0/planner/plans/${PLAN_ID}/buckets`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!bucketsRes.ok) {
      return res.status(500).json({ error: 'Error obteniendo buckets de Planner' });
    }

    const bucketsData = await bucketsRes.json();
    const pendienteBucket = bucketsData.value?.find(b => b.name === 'Pendiente');

    if (!pendienteBucket) {
      return res.status(500).json({ error: 'No se encontró bucket "Pendiente"' });
    }

    const bucketId = pendienteBucket.id;

    // Crear tarjetas en Planner
    const results = [];
    const urgenciaMap = {
      'Critica': 3,
      'Alta': 0,
      'Media': 1,
      'Baja': 2,
    };

    for (const item of items) {
      const fields = item.fields;
      const taskTitle = `[${fields.Tipo || 'Requerimiento'}] - ${fields.Title}`;
      const taskDescription = `**Solicitante:** ${fields.Solicitante || 'N/A'}\n\n**Necesidad:** ${fields.Necesidad || 'N/A'}\n\n**Urgencia:** ${fields.Urgencia || 'N/A'}`;
      const priority = urgenciaMap[fields.Urgencia] || 1;

      try {
        const taskRes = await fetch(
          'https://graph.microsoft.com/v1.0/planner/tasks',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              planId: PLAN_ID,
              bucketId: bucketId,
              title: taskTitle,
              priority: priority,
              details: {
                description: taskDescription,
              },
            }),
          }
        );

        if (taskRes.ok) {
          const taskData = await taskRes.json();
          results.push({ 
            success: true, 
            title: fields.Title, 
            taskId: taskData.id 
          });
        } else {
          const errorData = await taskRes.json();
          results.push({ 
            success: false, 
            title: fields.Title, 
            error: errorData.error?.message || 'Unknown error' 
          });
        }
      } catch (err) {
        results.push({ 
          success: false, 
          title: fields.Title, 
          error: err.message 
        });
      }

      // Pequeño delay para no saturar
      await new Promise(r => setTimeout(r, 300));
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return res.status(200).json({
      ok: true,
      summary: {
        total: items.length,
        success: successCount,
        errors: errorCount,
      },
      results,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
