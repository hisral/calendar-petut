import { Hono } from 'hono';
import { Bindings } from './bindings';

// Import Sub-Apps
import authApp from './routes/auth';
import calendarApp from './routes/calendar';
import cashflowApp from './routes/cashflow';
import notesApp from './routes/notes';
import adminApp from './routes/admin';

const app = new Hono<{ Bindings: Bindings }>();

// Gabungkan Semua Route
app.route('/', authApp);
app.route('/', calendarApp);
app.route('/', cashflowApp);
app.route('/', notesApp);
app.route('/', adminApp);

export default app;
