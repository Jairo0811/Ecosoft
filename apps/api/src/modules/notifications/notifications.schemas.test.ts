import { notificationQuerySchema } from './notifications.schemas';

describe('notificationQuerySchema', () => {
  it('normalizes unread and pagination filters', () => {
    expect(notificationQuerySchema.parse({ unread: 'true', page: '2' })).toMatchObject({
      unread: true,
      page: 2,
      pageSize: 25,
    });
  });
});
