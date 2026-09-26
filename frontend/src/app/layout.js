import './globals.css';

export const metadata = {
  title: 'Dhaka Pool',
  description: 'A demo ride-pooling app for Dhaka',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
