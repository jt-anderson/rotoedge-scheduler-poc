import Base from '../Base.js';

// to avoid dependency on `chronograph`
type AnyConstructor<A = any>   = new (...input: any[]) => A;

export declare class LocalizableMixin {

    static L<T extends typeof LocalizableMixin>(this : T, text : string, templateData?, ...localeClasses) : string

    L(text : string, templateData?) : string

}

declare const Localizable : <T extends AnyConstructor<Base>>(base : T) => AnyConstructor<InstanceType<T> & LocalizableMixin> & T & typeof LocalizableMixin;

export default Localizable;
