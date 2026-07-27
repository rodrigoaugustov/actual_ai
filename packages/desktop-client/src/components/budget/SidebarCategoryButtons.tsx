import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { CategoryEntity } from '@actual-app/core/types/models/category';

import { NotesButton } from '#components/NotesButton';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useNotes } from '#hooks/useNotes';

import { CategoryAutomationButton } from './goals/CategoryAutomationButton';

type SidebarCategoryButtonsProps = {
  category: CategoryEntity;
  dragging: boolean;
  goalsShown: boolean;
};

export const SidebarCategoryButtons = ({
  category,
  dragging,
  goalsShown,
}: SidebarCategoryButtonsProps) => {
  const { t } = useTranslation();
  const isGoalTemplatesUIEnabled = useFeatureFlag('goalTemplatesUIEnabled');
  const notes = useNotes(category.id) || '';

  return (
    <>
      <View style={{ flex: 1 }} />
      {!goalsShown && isGoalTemplatesUIEnabled && (
        <View style={{ flexShrink: 0 }}>
          <CategoryAutomationButton
            category={category}
            style={dragging ? { color: 'currentColor' } : undefined}
            defaultColor={theme.pageTextLight}
            showPlaceholder={!!notes}
          />
        </View>
      )}
      <View style={{ flexShrink: 0 }}>
        <NotesButton
          id={category.id}
          style={dragging ? { color: 'currentColor' } : undefined}
          defaultColor={theme.pageTextLight}
          label={t('Edit category description')}
          description={t(
            'This description helps your family and the Assistant categorize transactions.',
          )}
          placeholder={t(
            'Describe what belongs in this category and what should use another category.',
          )}
          maxLength={1000}
          showPlaceholder={
            !goalsShown &&
            isGoalTemplatesUIEnabled &&
            (!!category.goal_def?.length || !!category.cleanup_def?.length)
          }
        />
      </View>
    </>
  );
};
