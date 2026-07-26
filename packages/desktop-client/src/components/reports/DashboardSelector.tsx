import { useRef, useState } from 'react';
import { Dialog, DialogTrigger } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgExpandArrow } from '@actual-app/components/icons/v0';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { View } from '@actual-app/components/view';
import type { DashboardPageEntity } from '@actual-app/core/types/models';

import { useNavigate } from '#hooks/useNavigate';
import { useCreateDashboardPageMutation } from '#reports/mutations';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { reportsMenuClass } from './reportsStyles';

type DashboardSelectorProps = {
  dashboards: readonly DashboardPageEntity[];
  currentDashboard: DashboardPageEntity;
};

export function DashboardSelector({
  dashboards,
  currentDashboard,
}: DashboardSelectorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const triggerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const createDashboardPageMutation = useCreateDashboardPageMutation();

  const handleAddDashboard = async () => {
    const defaultName = t('New dashboard');
    createDashboardPageMutation.mutate(
      { name: defaultName },
      {
        onSuccess: id => {
          void navigate(`/reports/${id}`);
        },
      },
    );
  };

  return (
    <DialogTrigger>
      <Button
        ref={triggerRef}
        aria-label={t('Switch view, current: {{name}}', {
          name: currentDashboard.name,
        })}
        onPress={() => setMenuOpen(true)}
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 'auto',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          minHeight: 40,
          padding: '0 12px',
          color: nossoCaderninho.color.graphite,
          backgroundColor: nossoCaderninho.color.plate,
          border: `1px solid ${nossoCaderninho.color.rail}`,
          borderRadius: nossoCaderninho.radius.control,
          fontFamily: nossoCaderninho.font.family,
        }}
      >
        <View
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 'auto',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            textAlign: 'center',
          }}
        >
          {currentDashboard.name}
        </View>
        <SvgExpandArrow
          width={7}
          height={7}
          style={{
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: 'auto',
            marginLeft: 5,
          }}
        />
      </Button>

      {menuOpen && (
        <Popover
          triggerRef={triggerRef}
          isOpen
          onOpenChange={setMenuOpen}
          placement="bottom start"
        >
          <Dialog>
            <Menu
              className={reportsMenuClass}
              slot="close"
              onMenuSelect={item => {
                if (item === 'add-new') {
                  void handleAddDashboard();
                } else {
                  void navigate(`/reports/${item}`);
                }
                setMenuOpen(false);
              }}
              items={[
                ...dashboards.map(dashboard => ({
                  name: dashboard.id,
                  text: dashboard.name,
                })),
                Menu.line,
                {
                  name: 'add-new',
                  text: t('Add new dashboard'),
                },
              ]}
            />
          </Dialog>
        </Popover>
      )}
    </DialogTrigger>
  );
}
