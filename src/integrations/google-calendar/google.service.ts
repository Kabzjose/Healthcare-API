import { google } from 'googleapis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

// Helper function to create an isolated OAuth2 client per request to prevent race conditions
const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
};

// ── Generate the Google OAuth consent URL ────────────────────────────────────
export const getAuthUrl = (): string => {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',  
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent',       
  });
};

// ── Exchange auth code for tokens ─────────────────────────────────────────────
export const exchangeCodeForTokens = async (
  code: string
): Promise<{ access_token: string; refresh_token: string }> => {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain Google tokens');
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  };
};

// ── Create a calendar event ───────────────────────────────────────────────────
export const createCalendarEvent = async (params: {
  accessToken: string;
  refreshToken: string;
  summary: string;             
  description: string;
  date: string;                // YYYY-MM-DD
  startTime: string;           // HH:MM
  endTime: string;             // HH:MM
  attendeeEmails: string[];
  timeZone?: string;
}): Promise<string | null> => {
  try {
    const client = createOAuth2Client();
    client.setCredentials({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: client });
    const timeZone = params.timeZone ?? 'Africa/Nairobi';

    // FIX: Moved 'sendUpdates' to the root options level outside of 'requestBody'
    const event = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: 'all', 
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: {
          dateTime: `${params.date}T${params.startTime}:00`,
          timeZone,
        },
        end: {
          dateTime: `${params.date}T${params.endTime}:00`,
          timeZone,
        },
        attendees: params.attendeeEmails.map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, 
            { method: 'popup', minutes: 30 },       
          ],
        },
      },
    });

    logger.info('Google Calendar event created', { eventId: event.data.id });

    return event.data.id ?? null;
  } catch (err) {
    logger.error('Google Calendar event creation failed', { error: err });
    return null;
  }
};

// ── Delete a calendar event (on cancellation) ─────────────────────────────────
export const deleteCalendarEvent = async (params: {
  accessToken: string;
  refreshToken: string;
  eventId: string;
}): Promise<void> => {
  try {
    const client = createOAuth2Client();
    client.setCredentials({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: params.eventId,
      sendUpdates: 'all', 
    });

    logger.info('Google Calendar event deleted', { eventId: params.eventId });
  } catch (err) {
    logger.error('Google Calendar event deletion failed', { error: err });
  }
};

// ── Update a calendar event (e.g. doctor confirms → status changes) ───────────
export const updateCalendarEvent = async (params: {
  accessToken: string;
  refreshToken: string;
  eventId: string;
  summary?: string;
  description?: string;
}): Promise<void> => {
  try {
    const client = createOAuth2Client();
    client.setCredentials({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: client });

    await calendar.events.patch({
      calendarId: 'primary',
      eventId: params.eventId,
      sendUpdates: 'all',
      requestBody: {
        ...(params.summary && { summary: params.summary }),
        ...(params.description && { description: params.description }),
      },
    });

    logger.info('Google Calendar event updated', { eventId: params.eventId });
  } catch (err) {
    logger.error('Google Calendar event update failed', { error: err });
  }
};
