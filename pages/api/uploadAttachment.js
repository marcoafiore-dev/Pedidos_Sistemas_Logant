export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, fileContent, itemId } = req.body;

    if (!fileName || !fileContent || !itemId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;

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
      return res.status(500).json({ error: 'Failed to get token' });
    }

    const LIST_ID = '8f827ea8-c522-4d25-af7b-ddd936effa1c';

    const siteInfoRes = await fetch(
      'https://graph.microsoft.com/v1.0/sites/logisticaantartica.sharepoint.com:/sites/Sistemas',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const siteInfo = await siteInfoRes.json();

    const attachmentBuffer = Buffer.from(fileContent, 'base64');

    const attachRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteInfo.id}/lists/${LIST_ID}/items/${itemId}/attachments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
        body: attachmentBuffer,
      }
    );

    if (attachRes.ok) {
      return res.status(200).json({ ok: true, fileName });
    } else {
      const errorText = await attachRes.text();
      return res.status(400).json({ 
        error: 'Failed to upload attachment',
        details: errorText,
        status: attachRes.status,
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
}
