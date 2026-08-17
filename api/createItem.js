export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { formData } = req.body;

    // 1. Obtener token de Azure AD
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.AZURE_CLIENT_ID,
          client_secret: process.env.AZURE_CLIENT_SECRET,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(500).json({
        error: "Error obteniendo token",
        details: tokenData,
      });
    }

    // 2. Crear item en SharePoint
    const item = {
      fields: {
        Title: formData.Title,
        Tipo: formData.Tipo,
        Sistema: formData.Sistema || "",
        Necesidad: formData.Necesidad,
        MejoraEsperada: formData.MejoraEsperada || "",
        Impacto: formData.Impacto || "",
        Urgencia: formData.Urgencia,
        Areadenegocio: formData.Areadenegocio || "",
        Justificacion: formData.Justificacion,
        Estado: "Nuevo",
      },
    };

    const spResponse = await fetch(
      "https://graph.microsoft.com/v1.0/sites/logisticaantartica.sharepoint.com:/sites/Sistemas:/lists/Pedidos de Sistemas/items",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      }
    );

    const spData = await spResponse.json();

    if (!spResponse.ok) {
      return res.status(500).json({
        error: "Error creando item en SharePoint",
        details: spData,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Item creado exitosamente",
      data: spData,
    });

  } catch (error) {
    return res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    });
  }
}
