import React from 'react';

// Pages render immediately; the site's one authored motion lives in the paint swatches.
export default function PageWrapper({ children }) {
  return <div>{children}</div>;
}
