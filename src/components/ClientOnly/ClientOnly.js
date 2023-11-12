import React from 'react';

function ClientOnly({ children, ...delegated }) {
  // See https://www.joshwcomeau.com/react/the-perils-of-rehydration/
  const [hasMounted, setHasMounted] = React.useState(false);
  React.useEffect(() => {
    setHasMounted(true);
  }, []);
  if (!hasMounted) {
    return null;
  }
  return <div {...delegated}>{children}</div>;
}

export default ClientOnly;
