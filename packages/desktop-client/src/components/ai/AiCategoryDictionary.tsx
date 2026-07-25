import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type {
  AiCategoryProfileEntity,
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  useCreateCategoryGroupMutation,
  useCreateCategoryMutation,
  useDeleteCategoryGroupMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryGroupMutation,
  useUpdateCategoryMutation,
} from '#budget';
import { useCategories } from '#hooks/useCategories';

type CategoryRowProps = {
  category: CategoryEntity;
  description: string;
  isNarrowWidth: boolean;
  onDelete: () => void;
  onRename: (name: string) => Promise<void>;
  onSaveDescription: (description: string) => Promise<void>;
};

function CategoryRow({
  category,
  description,
  isNarrowWidth,
  onDelete,
  onRename,
  onSaveDescription,
}: CategoryRowProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(category.name);
  const [draftDescription, setDraftDescription] = useState(description);
  const [isSavingDescription, setIsSavingDescription] = useState(false);

  useEffect(() => setName(category.name), [category.name]);
  useEffect(() => setDraftDescription(description), [description]);

  async function saveDescription() {
    if (isSavingDescription) return;
    setIsSavingDescription(true);
    try {
      await onSaveDescription(draftDescription);
    } finally {
      setIsSavingDescription(false);
    }
  }

  return (
    <View
      style={{
        flexDirection: isNarrowWidth ? 'column' : 'row',
        alignItems: isNarrowWidth ? 'stretch' : 'center',
        gap: 8,
        padding: 8,
        borderTop: '1px solid ' + theme.tableBorder,
      }}
    >
      <Input
        aria-label={t('Category name')}
        value={name}
        style={{ flex: 1 }}
        onChangeValue={setName}
        onUpdate={value => {
          const normalizedName = value.trim();
          if (normalizedName && normalizedName !== category.name) {
            void onRename(normalizedName);
          } else {
            setName(category.name);
          }
        }}
      />
      <Input
        aria-label={t('Category description for AI')}
        value={draftDescription}
        maxLength={1000}
        placeholder={t(
          'What belongs here, and what should use another category?',
        )}
        style={{ flex: 3 }}
        onChangeValue={setDraftDescription}
      />
      <ButtonWithLoading
        isLoading={isSavingDescription}
        isDisabled={isSavingDescription}
        onPress={saveDescription}
      >
        <Trans>Save description</Trans>
      </ButtonWithLoading>
      <Button
        variant="bare"
        aria-label={t('Delete category {{name}}', { name: category.name })}
        onPress={onDelete}
      >
        <Trans>Delete</Trans>
      </Button>
    </View>
  );
}

type GroupSectionProps = {
  group: CategoryGroupEntity;
  profilesByCategory: Map<string, string>;
  isNarrowWidth: boolean;
  onProfilesChanged: () => Promise<void>;
};

function GroupSection({
  group,
  profilesByCategory,
  isNarrowWidth,
  onProfilesChanged,
}: GroupSectionProps) {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState(group.name);
  const [newCategoryName, setNewCategoryName] = useState('');
  const createCategory = useCreateCategoryMutation();
  const updateCategory = useUpdateCategoryMutation();
  const deleteCategory = useDeleteCategoryMutation();
  const updateGroup = useUpdateCategoryGroupMutation();
  const deleteGroup = useDeleteCategoryGroupMutation();

  useEffect(() => setGroupName(group.name), [group.name]);

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    await createCategory.mutateAsync({
      name,
      groupId: group.id,
      isIncome: group.is_income ?? false,
      isHidden: false,
    });
    setNewCategoryName('');
  }

  return (
    <View
      style={{
        border: '1px solid ' + theme.tableBorder,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: isNarrowWidth ? 'column' : 'row',
          alignItems: isNarrowWidth ? 'stretch' : 'center',
          gap: 8,
          padding: 8,
          backgroundColor: theme.tableHeaderBackground,
        }}
      >
        <Input
          aria-label={t('Category group name')}
          value={groupName}
          style={{ flex: 1, fontWeight: 600 }}
          onChangeValue={setGroupName}
          onUpdate={value => {
            const normalizedName = value.trim();
            if (normalizedName && normalizedName !== group.name) {
              void updateGroup.mutateAsync({
                group: { ...group, name: normalizedName },
              });
            } else {
              setGroupName(group.name);
            }
          }}
        />
        <Button
          variant="bare"
          aria-label={t('Delete category group {{name}}', {
            name: group.name,
          })}
          onPress={() => deleteGroup.mutate({ id: group.id })}
        >
          <Trans>Delete group</Trans>
        </Button>
      </View>

      {(group.categories ?? []).map(category => (
        <CategoryRow
          key={category.id}
          category={category}
          description={profilesByCategory.get(category.id) ?? ''}
          isNarrowWidth={isNarrowWidth}
          onDelete={() => deleteCategory.mutate({ id: category.id })}
          onRename={async name => {
            await updateCategory.mutateAsync({
              category: { ...category, name },
            });
          }}
          onSaveDescription={async description => {
            await send('ai/update-category-profile', {
              categoryId: category.id,
              description,
            });
            await onProfilesChanged();
          }}
        />
      ))}

      <View
        style={{
          flexDirection: isNarrowWidth ? 'column' : 'row',
          alignItems: isNarrowWidth ? 'stretch' : 'center',
          gap: 8,
          padding: 8,
          borderTop: '1px solid ' + theme.tableBorder,
        }}
      >
        <Input
          aria-label={t('New category name')}
          value={newCategoryName}
          placeholder={t('New category')}
          style={{ flex: 1 }}
          onChangeValue={setNewCategoryName}
          onEnter={addCategory}
        />
        <ButtonWithLoading
          isLoading={createCategory.isPending}
          isDisabled={createCategory.isPending || !newCategoryName.trim()}
          onPress={addCategory}
        >
          <Trans>Add category</Trans>
        </ButtonWithLoading>
      </View>
    </View>
  );
}

export function AiCategoryDictionary() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const queryClient = useQueryClient();
  const [newGroupName, setNewGroupName] = useState('');
  const createGroup = useCreateCategoryGroupMutation();
  const { data: categories } = useCategories();
  const { data: profiles = [] } = useQuery({
    queryKey: ['ai-category-profiles'],
    queryFn: () => send('ai/get-category-profiles'),
  });
  const refreshProfiles = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['ai-category-profiles'],
      });
    },
  });

  const profilesByCategory = new Map(
    (profiles as AiCategoryProfileEntity[]).map(profile => [
      profile.categoryId,
      profile.description,
    ]),
  );

  async function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    await createGroup.mutateAsync({ name });
    setNewGroupName('');
  }

  return (
    <View
      style={{
        width: '100%',
        borderTop: '1px solid ' + theme.pillBorderDark,
        paddingTop: 10,
        gap: 10,
      }}
    >
      <Text style={{ fontWeight: 600 }}>
        <Trans>AI category dictionary</Trans>
      </Text>
      <Text style={{ color: theme.pageTextSubdued }}>
        <Trans>
          Explain what belongs in each category. These descriptions are sent as
          stable taxonomy context to the classifier. Renaming or deleting a
          category here changes the budget itself.
        </Trans>
      </Text>

      {(categories?.grouped ?? []).map(group => (
        <GroupSection
          key={group.id}
          group={group}
          profilesByCategory={profilesByCategory}
          isNarrowWidth={isNarrowWidth}
          onProfilesChanged={async () => {
            await refreshProfiles.mutateAsync();
          }}
        />
      ))}

      <View
        style={{
          flexDirection: isNarrowWidth ? 'column' : 'row',
          alignItems: isNarrowWidth ? 'stretch' : 'center',
          gap: 8,
        }}
      >
        <Input
          aria-label={t('New category group name')}
          value={newGroupName}
          placeholder={t('New category group')}
          style={{ flex: 1 }}
          onChangeValue={setNewGroupName}
          onEnter={addGroup}
        />
        <ButtonWithLoading
          isLoading={createGroup.isPending}
          isDisabled={createGroup.isPending || !newGroupName.trim()}
          onPress={addGroup}
        >
          <Trans>Add group</Trans>
        </ButtonWithLoading>
      </View>
    </View>
  );
}
