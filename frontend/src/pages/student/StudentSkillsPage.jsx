import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Input, Select } from '../../components/ui/Field.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { skillApi, studentApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * The skills listed on the student's profile.
 *
 * A drive can mark skills as required, so a complete skill list is the
 * cheapest way to stay eligible for more drives.
 */
export default function StudentSkillsPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => studentApi.mySkills(), []);
  const { data: taxonomy } = useApi(() => skillApi.list({ page_size: 100 }), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ skill: '', proficiency_level: 3, is_certified: false });
  const [saving, setSaving] = useState(false);

  const skills = Array.isArray(data) ? data : data?.results ?? [];
  const catalogue = Array.isArray(taxonomy) ? taxonomy : taxonomy?.results ?? [];

  useEffect(() => {
    if (catalogue.length && !form.skill) {
      setForm((current) => ({ ...current, skill: catalogue[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue]);

  async function handleAdd(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await studentApi.addSkill({
        skill: Number(form.skill),
        proficiency_level: Number(form.proficiency_level),
        is_certified: form.is_certified,
      });
      toast.success('Skill added to your profile.');
      setModalOpen(false);
      setForm({ skill: catalogue[0]?.id ?? '', proficiency_level: 3, is_certified: false });
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(skill) {
    try {
      await studentApi.removeSkill(skill.id);
      toast.success(`${skill.skill_name} removed.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <PageHeader
        title="My skills"
        description="Recruiters filter applicants by skill and drives can list skills as required."
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add skill
          </Button>
        }
      />

      {loading && <LoadingState label="Loading your skills..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          <CardHeader title={`${skills.length} skill(s) on your profile`} />
          {skills.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="No skills listed yet"
              description="Add the skills you have so far - required skills on a drive are checked against this list."
            />
          ) : (
            <Table
              columns={[
                { key: 'name', header: 'Skill' },
                { key: 'level', header: 'Proficiency' },
                { key: 'certified', header: 'Certified' },
                { key: 'actions', header: '' },
              ]}
            >
              {skills.map((skill) => (
                <Tr key={skill.id}>
                  <Td className="font-medium text-navy-900">{skill.skill_name}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-navy-200">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${(skill.proficiency_level / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-navy-500">{skill.proficiency_level}/5</span>
                    </div>
                  </Td>
                  <Td>
                    {skill.is_certified ? (
                      <Badge variant="success">Certified</Badge>
                    ) : (
                      <Badge variant="neutral">Self reported</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(skill)}
                      aria-label={`Remove ${skill.skill_name}`}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" aria-hidden="true" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        title="Add a skill"
        description="Only skills from the shared taxonomy can be attached."
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} loading={saving}>
              Add skill
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleAdd}>
          <Select
            label="Skill"
            value={form.skill}
            onChange={(event) => setForm({ ...form, skill: event.target.value })}
            required
          >
            {catalogue.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name} ({skill.category})
              </option>
            ))}
          </Select>
          <Input
            label="Proficiency level"
            type="number"
            min="1"
            max="5"
            value={form.proficiency_level}
            onChange={(event) => setForm({ ...form, proficiency_level: event.target.value })}
            hint="1 = beginner, 5 = expert."
          />
          <label className="inline-flex items-center gap-2 text-sm text-navy-700">
            <input
              type="checkbox"
              checked={form.is_certified}
              onChange={(event) => setForm({ ...form, is_certified: event.target.checked })}
              className="h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
            />
            I hold a certification for this skill
          </label>
          <CardBody className="rounded-lg bg-navy-50 p-3 text-xs text-navy-500">
            The proficiency level is stored on the profile and is available to recruiters when they
            review an applicant.
          </CardBody>
        </form>
      </Modal>
    </>
  );
}
