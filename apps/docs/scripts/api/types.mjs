// TypeDoc type nodes → the model's TypeRef token runs (see src/api/model.ts).
// Named types that resolve to a documented symbol carry its page as `href`,
// which is how `<TypeLink>` links types across entry points.

/**
 * @param {(id: number) => string | undefined} hrefFor page of a reflection id
 */
export function createTypePrinter(hrefFor) {
  /** @returns {{text: string, parts: Array<{kind: string, text: string, href?: string}>}} */
  function print(type) {
    const parts = [];
    emit(type, parts, 0);
    return finish(parts);
  }

  function finish(parts) {
    const merged = [];
    for (const part of parts) {
      const last = merged[merged.length - 1];
      if (
        last &&
        !last.href &&
        !part.href &&
        last.kind === part.kind &&
        (part.kind === 'punct' || part.kind === 'text')
      ) {
        last.text += part.text;
      } else {
        merged.push({ ...part });
      }
    }
    return { text: merged.map((part) => part.text).join(''), parts: merged };
  }

  const p = (parts, text) => parts.push({ kind: 'punct', text });
  const kw = (parts, text) => parts.push({ kind: 'keyword', text });

  // Precedence: 0 top, 1 inside union, 2 inside intersection, 3 array element.
  function emit(type, parts, prec) {
    if (!type) {
      kw(parts, 'unknown');
      return;
    }
    switch (type.type) {
      case 'intrinsic':
        kw(parts, type.name);
        return;
      case 'literal': {
        const value = type.value;
        let text;
        if (value === null) text = 'null';
        else if (typeof value === 'object' && 'value' in value)
          text = `${value.negative ? '-' : ''}${value.value}n`;
        else if (typeof value === 'string')
          text = `'${value.replace(/'/g, "\\'")}'`;
        else text = String(value);
        parts.push({ kind: value === null ? 'keyword' : 'literal', text });
        return;
      }
      case 'reference': {
        const href =
          typeof type.target === 'number' && !type.refersToTypeParameter
            ? hrefFor(type.target)
            : undefined;
        parts.push({
          kind: type.refersToTypeParameter ? 'param' : 'ref',
          text: type.name,
          ...(href ? { href } : {}),
        });
        if (type.typeArguments?.length) {
          p(parts, '<');
          type.typeArguments.forEach((arg, i) => {
            if (i > 0) p(parts, ', ');
            emit(arg, parts, 0);
          });
          p(parts, '>');
        }
        return;
      }
      case 'union':
      case 'intersection': {
        const own = type.type === 'union' ? 1 : 2;
        const wrap = prec > own;
        if (wrap) p(parts, '(');
        type.types.forEach((member, i) => {
          if (i > 0) p(parts, type.type === 'union' ? ' | ' : ' & ');
          emit(member, parts, own);
        });
        if (wrap) p(parts, ')');
        return;
      }
      case 'array':
        emit(type.elementType, parts, 3);
        p(parts, '[]');
        return;
      case 'tuple':
        p(parts, '[');
        (type.elements ?? []).forEach((element, i) => {
          if (i > 0) p(parts, ', ');
          emit(element, parts, 0);
        });
        p(parts, ']');
        return;
      case 'namedTupleMember':
        parts.push({ kind: 'name', text: type.name });
        p(parts, type.isOptional ? '?: ' : ': ');
        emit(type.element, parts, 0);
        return;
      case 'optional':
        emit(type.elementType, parts, 3);
        p(parts, '?');
        return;
      case 'rest':
        p(parts, '...');
        emit(type.elementType, parts, 3);
        return;
      case 'typeOperator':
        kw(parts, `${type.operator} `);
        emit(type.target, parts, 3);
        return;
      case 'query':
        kw(parts, 'typeof ');
        emit(type.queryType, parts, 3);
        return;
      case 'indexedAccess':
        emit(type.objectType, parts, 3);
        p(parts, '[');
        emit(type.indexType, parts, 0);
        p(parts, ']');
        return;
      case 'conditional': {
        const wrap = prec > 0;
        if (wrap) p(parts, '(');
        emit(type.checkType, parts, 3);
        kw(parts, ' extends ');
        emit(type.extendsType, parts, 1);
        p(parts, ' ? ');
        emit(type.trueType, parts, 0);
        p(parts, ' : ');
        emit(type.falseType, parts, 0);
        if (wrap) p(parts, ')');
        return;
      }
      case 'mapped':
        p(parts, '{ ');
        if (type.readonlyModifier)
          kw(parts, `${type.readonlyModifier === '-' ? '-' : ''}readonly `);
        p(parts, '[');
        parts.push({ kind: 'param', text: type.parameter });
        kw(parts, ' in ');
        emit(type.parameterType, parts, 0);
        if (type.nameType) {
          kw(parts, ' as ');
          emit(type.nameType, parts, 0);
        }
        p(parts, ']');
        if (type.optionalModifier)
          p(parts, type.optionalModifier === '-' ? '-?' : '?');
        p(parts, ': ');
        emit(type.templateType, parts, 0);
        p(parts, ' }');
        return;
      case 'templateLiteral':
        parts.push({ kind: 'literal', text: `\`${type.head}` });
        for (const [inner, tail] of type.tail) {
          parts.push({ kind: 'literal', text: '${' });
          emit(inner, parts, 0);
          parts.push({ kind: 'literal', text: `}${tail}` });
        }
        parts.push({ kind: 'literal', text: '`' });
        return;
      case 'predicate':
        if (type.asserts) kw(parts, 'asserts ');
        parts.push({ kind: 'name', text: type.name });
        if (type.targetType) {
          kw(parts, ' is ');
          emit(type.targetType, parts, 0);
        }
        return;
      case 'inferred':
        kw(parts, 'infer ');
        parts.push({ kind: 'param', text: type.name });
        return;
      case 'reflection':
        emitReflection(type.declaration, parts, prec);
        return;
      case 'unknown':
        parts.push({ kind: 'text', text: type.name });
        return;
      default:
        parts.push({ kind: 'text', text: type.name ?? type.type });
    }
  }

  function emitSignatureType(signature, parts, arrow) {
    if (signature.typeParameters?.length)
      emitTypeParams(signature.typeParameters, parts);
    p(parts, '(');
    (signature.parameters ?? []).forEach((param, i) => {
      if (i > 0) p(parts, ', ');
      if (param.flags?.isRest) p(parts, '...');
      parts.push({ kind: 'name', text: param.name });
      p(parts, param.flags?.isOptional ? '?: ' : ': ');
      emit(param.type, parts, 0);
    });
    p(parts, arrow ? ') => ' : '): ');
    emit(signature.type, parts, 0);
  }

  function emitTypeParams(typeParameters, parts) {
    p(parts, '<');
    typeParameters.forEach((param, i) => {
      if (i > 0) p(parts, ', ');
      parts.push({ kind: 'param', text: param.name });
      if (param.type) {
        kw(parts, ' extends ');
        emit(param.type, parts, 0);
      }
      if (param.default) {
        p(parts, ' = ');
        emit(param.default, parts, 0);
      }
    });
    p(parts, '>');
  }

  function emitReflection(declaration, parts, prec) {
    if (!declaration) {
      p(parts, '{}');
      return;
    }
    const children = declaration.children ?? [];
    const signatures = declaration.signatures ?? [];
    const index = declaration.indexSignatures ?? [];
    if (
      children.length === 0 &&
      index.length === 0 &&
      signatures.length === 1
    ) {
      const wrap = prec > 0;
      if (wrap) p(parts, '(');
      emitSignatureType(signatures[0], parts, true);
      if (wrap) p(parts, ')');
      return;
    }
    if (
      children.length === 0 &&
      index.length === 0 &&
      signatures.length === 0
    ) {
      p(parts, '{}');
      return;
    }
    p(parts, '{ ');
    let first = true;
    const sep = () => {
      if (!first) p(parts, '; ');
      first = false;
    };
    for (const signature of signatures) {
      sep();
      emitSignatureType(signature, parts, false);
    }
    for (const signature of index) {
      sep();
      p(parts, '[');
      const param = signature.parameters?.[0];
      parts.push({ kind: 'name', text: param?.name ?? 'key' });
      p(parts, ': ');
      emit(param?.type, parts, 0);
      p(parts, ']: ');
      emit(signature.type, parts, 0);
    }
    for (const child of children) {
      sep();
      if (child.flags?.isReadonly) kw(parts, 'readonly ');
      parts.push({ kind: 'name', text: child.name });
      if (child.signatures?.length) {
        if (child.flags?.isOptional) p(parts, '?');
        emitSignatureType(child.signatures[0], parts, false);
      } else {
        p(parts, child.flags?.isOptional ? '?: ' : ': ');
        emit(child.type, parts, 0);
      }
    }
    p(parts, ' }');
  }

  /** A function-type rendering of a signature, e.g. for method members. */
  function printSignature(signature) {
    const parts = [];
    emitSignatureType(signature, parts, true);
    return finish(parts);
  }

  return { print, printSignature };
}
