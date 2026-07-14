import { MultiInputControl } from '@color-kit/control-kit';
import { parsePrimitiveExpression } from '../../color/parse-expression.js';
import {
  MULTI_INPUT_FIELDS,
  type MultiInputConfig,
  type MultiInputFieldId,
} from '../../fixtures/multi-input-fields.js';

export function MultiInputPlaygroundStage({
  values,
  config,
  onFieldChange,
}: {
  values: Record<MultiInputFieldId, number>;
  config: MultiInputConfig;
  onFieldChange: (field: MultiInputFieldId, value: number) => void;
}) {
  return (
    <div className="w-[200px] min-w-0 max-w-full">
      <MultiInputControl
        values={values}
        config={config}
        onFieldChange={onFieldChange}
        fields={MULTI_INPUT_FIELDS}
        parseExpression={parsePrimitiveExpression}
      />
    </div>
  );
}
