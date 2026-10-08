import type { ApiMember, ApiParam, TypeRef } from '@/api/model';
import { RichCompact } from './rich-text';
import { TypeView } from './type-link';
import { memberAnchor, paramAnchor } from './declaration';

/**
 * `<Params>`: a definition list of parameters or members. Each row shows
 * name, type (named types linked), default and description, and carries the
 * anchor the declaration's names link to.
 */

interface Row {
  id: string;
  name: string;
  /** Prefix drawn before the name, e.g. `options.` for expanded fields. */
  path?: string;
  type: TypeRef;
  optional: boolean;
  flags: string[];
  defaultValue?: string;
  description: ApiParam['description'];
  deprecated?: string;
}

function ParamRow({ row }: { row: Row }) {
  const hasText = row.description.length > 0 || row.deprecated !== undefined;
  return (
    <div id={row.id} className="params__row">
      <dt>
        <a className="params__name" href={`#${row.id}`}>
          {row.path ? <span className="params__path">{row.path}</span> : null}
          {row.name}
          {row.optional ? <span className="params__optional">?</span> : null}
        </a>
        <code className="params__type">
          <TypeView type={row.type} />
        </code>
        {row.defaultValue !== undefined ? (
          <span className="params__default">
            <span className="params__default-label">default</span>{' '}
            <code>{row.defaultValue}</code>
          </span>
        ) : null}
        {row.flags.map((flag) => (
          <span key={flag} className="api-label">
            {flag}
          </span>
        ))}
        {row.deprecated !== undefined ? (
          <span className="api-label" data-deprecated="">
            deprecated
          </span>
        ) : null}
      </dt>
      {hasText ? (
        <dd>
          {row.deprecated ? (
            <p className="params__deprecated">{row.deprecated}</p>
          ) : null}
          <RichCompact blocks={row.description} />
        </dd>
      ) : null}
    </div>
  );
}

function paramRows(params: ApiParam[], overload: number): Row[] {
  return params.flatMap((param) => [
    {
      id: paramAnchor(param.name, overload),
      name: param.rest ? `...${param.name}` : param.name,
      type: param.type,
      optional: param.optional && !param.rest,
      flags: [],
      defaultValue: param.default,
      description: param.description,
    },
    ...(param.children ?? []).map((child) => ({
      id: paramAnchor(`${param.name}.${child.name}`, overload),
      path: `${param.name}.`,
      name: child.name,
      type: child.type,
      optional: child.optional,
      flags: [],
      defaultValue: child.default,
      description: child.description,
    })),
  ]);
}

export function Params({
  params,
  overload = 0,
}: {
  params: ApiParam[];
  /** Overload index, keeps anchors unique across overloads. */
  overload?: number;
}) {
  if (params.length === 0) return null;
  return (
    <dl className="params">
      {paramRows(params, overload).map((row) => (
        <ParamRow key={row.id} row={row} />
      ))}
    </dl>
  );
}

/** Members of an interface, class or props type, in declaration order. */
export function Members({ members }: { members: ApiMember[] }) {
  if (members.length === 0) return null;
  return (
    <dl className="params">
      {members.map((member) => (
        <ParamRow
          key={member.name}
          row={{
            id: memberAnchor(member.name),
            name: member.indexParameter
              ? `[${member.indexParameter.name}: ${member.indexParameter.type.text}]`
              : member.name,
            type: member.type,
            optional: member.optional,
            flags: [
              ...(member.static ? ['static'] : []),
              ...(member.readonly ? ['readonly'] : []),
              ...(member.kind === 'method' ? ['method'] : []),
            ],
            defaultValue: member.default,
            description: member.description,
            deprecated: member.deprecated,
          }}
        />
      ))}
    </dl>
  );
}
