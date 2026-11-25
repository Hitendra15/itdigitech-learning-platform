import api, { errorMessage } from "../api/client.js";

/** Downloads the PDF through the API (it needs the login token, so a plain link will not work). */
export async function downloadCertificate(code) {
  try {
    const res = await api.get(`/certificates/${code}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url; a.download = `IT-DigiTech-Certificate-${code}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return null;
  } catch (err) {
    return errorMessage(err, "Could not download the certificate. Try again.");
  }
}
