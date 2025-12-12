import { Hono } from 'hono';
import { Bindings } from './bindings';

import authApp from './routes/auth';
import homeApp from './routes/home'; // <-- IMPORT BARU
import calendarApp from './routes/calendar';
import cashflowApp from './routes/cashflow';
import notesApp from './routes/notes';
import adminApp from './routes/admin';

const app = new Hono<{ Bindings: Bindings }>();

app.route('/', authApp);
app.route('/', homeApp); 
app.route('/', calendarApp);
app.route('/', cashflowApp);
app.route('/', notesApp);
app.route('/', adminApp);

export default app;
