import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestQueryClient, TestProviders } from '#mocks';

import { AiCategoryDictionary } from './AiCategoryDictionary';

const mutations = vi.hoisted(() => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));
const sendMock = vi.hoisted(() => vi.fn());

vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({ isNarrowWidth: false }),
}));
vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: sendMock,
}));
vi.mock('#hooks/useCategories', () => ({
  useCategories: () => ({
    data: {
      grouped: [
        {
          id: 'food',
          name: 'Food',
          is_income: false,
          categories: [
            {
              id: 'restaurants',
              name: 'Restaurants',
              group: 'food',
            },
          ],
        },
      ],
      list: [],
    },
  }),
}));
vi.mock('#budget', () => ({
  useCreateCategoryMutation: () => ({
    mutateAsync: mutations.createCategory,
    isPending: false,
  }),
  useUpdateCategoryMutation: () => ({
    mutateAsync: mutations.updateCategory,
  }),
  useDeleteCategoryMutation: () => ({ mutate: mutations.deleteCategory }),
  useCreateCategoryGroupMutation: () => ({
    mutateAsync: mutations.createGroup,
    isPending: false,
  }),
  useUpdateCategoryGroupMutation: () => ({
    mutateAsync: mutations.updateGroup,
  }),
  useDeleteCategoryGroupMutation: () => ({ mutate: mutations.deleteGroup }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockImplementation(async (method: string) => {
    if (method === 'ai/get-category-profiles') {
      return [
        {
          id: 'profile',
          categoryId: 'restaurants',
          description: 'Meals away from home.',
          updatedAt: 1,
        },
      ];
    }
    if (method === 'ai/update-category-profile') return null;
    throw new Error(`Unexpected method: ${method}`);
  });
});

describe('AiCategoryDictionary', () => {
  it('edits budget taxonomy and saves classifier descriptions', async () => {
    const user = userEvent.setup();
    render(
      <TestProviders queryClient={createTestQueryClient()}>
        <AiCategoryDictionary />
      </TestProviders>,
    );

    const description = await screen.findByDisplayValue(
      'Meals away from home.',
    );
    await user.clear(description);
    await user.type(description, 'Restaurants, delivery and dining clubs.');
    await user.click(screen.getByRole('button', { name: 'Save description' }));
    expect(sendMock).toHaveBeenCalledWith('ai/update-category-profile', {
      categoryId: 'restaurants',
      description: 'Restaurants, delivery and dining clubs.',
    });

    const categoryName = screen.getByLabelText('Category name');
    await user.clear(categoryName);
    await user.type(categoryName, 'Dining');
    await user.tab();
    expect(mutations.updateCategory).toHaveBeenCalledWith({
      category: expect.objectContaining({ id: 'restaurants', name: 'Dining' }),
    });

    await user.type(screen.getByLabelText('New category name'), 'Groceries');
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    expect(mutations.createCategory).toHaveBeenCalledWith({
      name: 'Groceries',
      groupId: 'food',
      isIncome: false,
      isHidden: false,
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Delete category Restaurants',
      }),
    );
    expect(mutations.deleteCategory).toHaveBeenCalledWith({
      id: 'restaurants',
    });
  });
});
