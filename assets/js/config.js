// Site configuration. Everything here is public by design — never put a secret in this file.

export const config = {
  // Résumé destination used by every "Résumé" link. Point it at a PDF in this repo
  // (e.g. "assets/docs/Harsh_Agarwal_Resume.pdf") or at a public share link.
  resumeUrl: 'https://drive.google.com/file/d/1NM0YT_uRSXG6S4tKwD47B3GF6WAhz4dG/view?usp=drive_link',

  contact: {
    // How the contact form delivers messages:
    //   'auto'      – Formspree if `formspreeEndpoint` is set, else Netlify Forms on a Netlify host,
    //                 else hand the composed message to the visitor's email app (mailto).
    //   'formspree' – POST to `formspreeEndpoint` (works on any static host, incl. GitHub Pages).
    //   'netlify'   – POST to Netlify Forms (requires form detection enabled on the Netlify site).
    //   'mailto'    – never send from the page; open the visitor's email app instead.
    provider: 'auto',

    // Formspree form endpoint, e.g. 'https://formspree.io/f/abcdwxyz'.
    // The form ID is a public identifier, not a credential; delivery settings live in Formspree.
    formspreeEndpoint: '',

    // Hosts that are served by Netlify (any *.netlify.app host is detected automatically).
    netlifyHosts: ['harshagarwal-portfolio.netlify.app'],

    // Recipient for the mailto fallback and for error messages.
    email: 'harshagarwal.4404@gmail.com',

    timeoutMs: 15000,
  },
};
