# Pedidos de Sistemas - LOGANT

Formulario de solicitud de desarrollos/mejoras de sistemas para LOGANT. Envía las solicitudes directamente a la lista de SharePoint "Pedidos de Sistemas" vía Microsoft Graph.

## Stack
- Next.js (Pages Router) + React
- API route serverless (`pages/api/createItem.js`) que autentica con Azure AD (client_credentials) y crea el item en SharePoint vía Microsoft Graph

## Deploy
Producción: https://pedidos-sistemas-logant.vercel.app/

Variables de entorno requeridas en Vercel:
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`

## Notas importantes
- El permiso `Sites.ReadWrite.All` debe estar otorgado como **Application permission bajo la API "Microsoft Graph"** (no bajo la API legacy "SharePoint") en el App Registration "Pedidos Sistemas Form" en Entra ID, con admin consent.
- Los valores de los campos tipo Choice (`Tipo`, `Sistema`, `Urgencia`, `Areadenegocio`, `Estado`) deben coincidir exactamente con las opciones configuradas en la columna correspondiente de la lista SharePoint. Si se agrega/cambia una opción en el formulario, hay que actualizar también la columna en SharePoint (y viceversa).
