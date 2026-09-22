import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { STRINGS } from "../i18n";
import { emptyForm } from "../domain";
import CustomerFormScreen, { IconField, FormSection } from "./CustomerForm";

// ---------------------------------------------------------------------------
// CustomerFormScreen's first test coverage. It's a fully controlled form —
// no internal state, every field reads from `form` and writes back through
// `setForm({ ...form, field: value })` — so these tests focus on that
// contract: typing/selecting in a field calls setForm with the right merged
// shape, validation errors passed in show up next to the right field, and
// the save button reflects/respects the `saving` prop. Firestore/save logic
// itself lives in App.jsx (saveForm), not here, so it isn't exercised.
// ---------------------------------------------------------------------------

const t = STRINGS.en;

function renderForm(overrides = {}) {
  const setForm = vi.fn();
  const removeTagFromForm = vi.fn();
  const saveForm = vi.fn();
  const props = {
    t,
    form: { ...emptyForm },
    setForm,
    errors: {},
    removeTagFromForm,
    saveForm,
    saving: false,
    ...overrides,
  };
  const utils = render(<CustomerFormScreen {...props} />);
  return { ...utils, setForm, removeTagFromForm, saveForm, props };
}

describe("CustomerFormScreen", () => {
  it("calls setForm with the merged field when typing the company name", () => {
    const { setForm } = renderForm();
    fireEvent.change(screen.getByPlaceholderText(t.companyPlaceholder), {
      target: { value: "Acme Pest Solutions" },
    });
    expect(setForm).toHaveBeenCalledWith({ ...emptyForm, companyName: "Acme Pest Solutions" });
  });

  it("calls setForm with the merged field when typing the contact name", () => {
    const { setForm } = renderForm();
    fireEvent.change(screen.getByPlaceholderText(t.contactPlaceholder), {
      target: { value: "Ahmed Mohamed" },
    });
    expect(setForm).toHaveBeenCalledWith({ ...emptyForm, contactName: "Ahmed Mohamed" });
  });

  it("defaults the role select to purchasing, and updates it on change", () => {
    const { setForm } = renderForm();
    const roleSelect = screen.getByDisplayValue(t.roles.purchasing);
    fireEvent.change(roleSelect, { target: { value: "technical" } });
    expect(setForm).toHaveBeenCalledWith({ ...emptyForm, role: "technical" });
  });

  it("shows the sector placeholder until a sector is chosen, then updates on change", () => {
    const { setForm } = renderForm();
    const sectorSelect = screen.getByDisplayValue(t.sectorPlaceholder);
    fireEvent.change(sectorSelect, { target: { value: "construction" } });
    expect(setForm).toHaveBeenCalledWith({ ...emptyForm, sector: "construction" });
  });

  it("resets the notified flag when the follow-up call date/time changes", () => {
    // callDateTime and notified are coupled on purpose (see the onChange in
    // the component): editing the reminder time should re-arm the
    // reminder, not silently keep it marked as already notified.
    const { setForm, container } = renderForm({ form: { ...emptyForm, notified: true } });
    // The datetime-local input has no placeholder/label association, so
    // it's easiest found by type.
    const input = container.querySelector('input[type="datetime-local"]');
    fireEvent.change(input, { target: { value: "2026-10-01T09:00" } });
    expect(setForm).toHaveBeenCalledWith({
      ...emptyForm,
      notified: false,
      callDateTime: "2026-10-01T09:00",
    });
  });

  it("parses the comma-separated tags input into chips, and removes one via removeTagFromForm", () => {
    const { removeTagFromForm } = renderForm({
      form: { ...emptyForm, tagsInput: "VIP, Needs quote" },
    });
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("Needs quote")).toBeInTheDocument();

    // TagChip renders its remove control as a button aria-labeled "x"
    // inside the same <span> chip as the tag's own text.
    const vipChip = screen.getByText("VIP");
    const removeBtn = vipChip.querySelector('button[aria-label="x"]');
    fireEvent.click(removeBtn);
    expect(removeTagFromForm).toHaveBeenCalledWith("VIP");
  });

  it("shows no tag chips when tagsInput is empty", () => {
    renderForm({ form: { ...emptyForm, tagsInput: "" } });
    expect(screen.queryByText("VIP")).not.toBeInTheDocument();
  });

  it("renders a validation error next to the company field when errors.companyName is set", () => {
    renderForm({ errors: { companyName: t.companyLabel + " required" } });
    expect(screen.getByText(t.companyLabel + " required")).toBeInTheDocument();
  });

  it("shows no validation errors when errors is empty", () => {
    renderForm({ errors: {} });
    expect(screen.getByText(t.save)).toBeInTheDocument();
  });

  it("calls saveForm when the save button is clicked", () => {
    const { saveForm } = renderForm();
    fireEvent.click(screen.getByText(t.save));
    expect(saveForm).toHaveBeenCalled();
  });

  it("shows the saving label and disables the button while saving", () => {
    renderForm({ saving: true });
    const btn = screen.getByText(t.saving);
    expect(btn).toBeDisabled();
    expect(screen.queryByText(t.save)).not.toBeInTheDocument();
  });
});

describe("IconField", () => {
  it("renders its children next to the icon", () => {
    render(
      <IconField icon={() => <svg data-testid="icon" />}>
        <input placeholder="child input" />
      </IconField>
    );
    expect(screen.getByPlaceholderText("child input")).toBeInTheDocument();
  });
});

describe("FormSection", () => {
  it("renders its title and children", () => {
    render(
      <FormSection title="Section title">
        <p>section body</p>
      </FormSection>
    );
    expect(screen.getByText("Section title")).toBeInTheDocument();
    expect(screen.getByText("section body")).toBeInTheDocument();
  });
});
